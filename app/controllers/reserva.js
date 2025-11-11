import { ReservaSchema } from "../schemas/reserva.js";
import {database} from "../database.js";
import dotenv from 'dotenv';

import Stripe from "stripe";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
async function addReserva(req, res) {
    const validation = ReservaSchema.validateReservaSinId(req.body);
    const token = req.cookies.access_token;
    if (!validation.success) {
        return res.status(400).send({ status: "Error", message: JSON.parse(validation.error.message) });
    }

    const { trayecto_id, status} = validation.data;
    const { username } = req.user;

    // Aquí iría la lógica para agregar la reserva a la base de datos
    console.log("Agregar reserva para el usuario:", username, "en el trayecto ID:", trayecto_id);
    const connection = await database.getConnection();

    let trayecto = await connection.query("SELECT disponible, precio,origen,conductor, destino FROM trayectos WHERE id = ?", [trayecto_id]);
    if (trayecto[0].length === 0) {
        return res.status(404).send({ status: "Error", message: "Trayecto no encontrado" });
    }
    trayecto = trayecto[0][0]
    let user = await connection.query("SELECT * FROM users WHERE username = ?", [req.user.username]);
    if (user[0].length === 0) {
        return res.status(404).send({ status: "Error", message: "Usuario no encontrado" });
    }
    let stripe_account = await connection.query("SELECT stripe_account_id FROM accounts WHERE username = ?", [trayecto.conductor]);

    stripe_account = stripe_account[0][0].stripe_account_id
    user = user[0][0]

    const cookieHeaderValue = `access_token=${token}`; // El formato debe ser 'nombre=valor'

    let totalAmount = trayecto.precio * 100;
    console.log("Se realiza la peticion del checkout")
    let checkout_session = await fetch(`${USUARIOS_URL}/api/payment/payment-intent/checkout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Cookie': cookieHeaderValue
        },
        body: JSON.stringify({
            amount:totalAmount,
            destination:stripe_account,
            currency: "eur",
            description : "Reserva de trayecto: " + trayecto_id + " desde " + trayecto.origen + " hasta " + trayecto.destino,
            success_url: "http://localhost:5173/trayecto/" + trayecto_id,
            cancel_url: "http://localhost:5173/trayecto/" + trayecto_id,
        }),
    }).then(async response => {
        if (!response.ok) {
            throw new Error(`${response.message}`);
        }

        return await response.json();
    })

    console.log(checkout_session)
    checkout_session = checkout_session.checkout_session

    let reserva = {
        username,
        trayecto_id,
        status,
        stripe_checkout_session_id: checkout_session.id,

    }
    
    let stripe_payment_intent_id = checkout_session.payment_intent;
    let stripe_payment_intent_status = checkout_session.payment_status;
    let disponible = trayecto.disponible;
    console.log("Disponibilidad del trayecto:", disponible);
    // Si no hay disponibilidad, devolver un error
    

    if (disponible === 0) {
        return res.status(404).send({ status: "Error", message: "El trayecto no tiene asiento libres" });
    }

    // Inserta la reserva en la base de datos
    let result= null;
    try{

    [result] = await connection.query(
        "INSERT INTO reservas (username, id_trayecto, status, stripe_checkout_session_id) VALUES (?, ?, ?, ?)",
        [username, trayecto_id, status, reserva.stripe_checkout_session_id]
    );
    }
    catch(error){
        switch (error.code) {
            case 'ER_NO_REFERENCED_ROW_2':
                return res.status(400).send({ status: "Error", message: "El usuario o trayecto no existen" });
                
            case 'ER_DUP_ENTRY':
                return res.status(400).send({ status: "Error", message: "El usuario ya tiene una reserva para este trayecto" });
            default:
                return res.status(500).send({ status: "Error", message: "Error al crear la reserva" });
        }
    }

    if (result.affectedRows === 0) {
        return res.status(500).send({ status: "Error", message: "No se pudo crear la reserva" });
    }
    const [result_updated_trayecto] = await connection.query("UPDATE trayectos SET disponible = disponible - 1 WHERE id = ?", [trayecto_id]);
    if (result_updated_trayecto.affectedRows === 0) {
        return res.status(500).send({ status: "Error", message: "No se pudo actualizar la disponibilidad del trayecto" });
    }
    const newReserva = { id: result.insertId, username, trayecto_id, stripe_checkout_session_id: checkout_session.id };

    return res.status(201).send({
        status: "Success",
        message: "Reserva creada correctamente",
        reserva: newReserva,
        stripe_url: checkout_session.url
    });


}

async function getReservasByTravelId(req,res){
    const { travelId } = req.params;
    const connection = await database.getConnection();
    const trayecto = await connection.query("SELECT * FROM trayectos WHERE id = ?", [travelId]);
    if(trayecto[0].length === 0){
        return res.status(404).send({ status: "Error", message: "No se ha encontrado este trayecto" });
    }
    let pasajerosList = await connection.query("SELECT * FROM reservas WHERE id_trayecto = ?", [travelId]);
    pasajerosList = pasajerosList[0]
    //Agregar info adicional como la img_perfil y el nombre
    pasajerosList = await Promise.all(pasajerosList.map(async pasajero => {
        const img_perfil = await connection.query("SELECT img_perfil, name FROM users WHERE username = ?", [pasajero.username]);
        return {...pasajero, img_perfil: img_perfil[0][0].img_perfil, nombre: img_perfil[0][0].nombre};
    }));


    return res.status(200).send({
        status: "Success",
        pasajerosList
    })

}

async function obtenerMisReservas(req, res){
    const { username } = req.user;
    const {usernameParam} = req.params

    if(username !== usernameParam){
        return res.status(401).send({ status: "Error", message: "No tienes permiso para ver las reservas de este usuario" });
    }

    const connection = await database.getConnection();
    let pasajerosList = await connection.query("SELECT * FROM reservas WHERE username = ?", [username]);
    if(pasajerosList[0].length === 0){
        return res.status(200).send({ status: "Success", message: "No se ha encontrado este trayecto o todavia no tiene reservas", pasajerosList: pasajerosList[0]});

    }
    pasajerosList = pasajerosList[0]

    for (let i = 0; i < pasajerosList.length; i++) {
        const trayecto = await connection.query("SELECT * FROM trayectos WHERE id = ?", [pasajerosList[i].id_trayecto]);
        pasajerosList[i].trayecto = trayecto[0][0];
    }

    return res.status(200).send({
        status: "Success",
        pasajerosList
    })
}

async function deleteReserva(req,res){
    const { id } = req.params;
    const connection = await database.getConnection();
    let trayecto_id = await connection.query("SELECT id_trayecto FROM reservas WHERE id_reserva = ?", [id]);
    if (trayecto_id[0].length === 0) {
        return res.status(404).send({ status: "Error", message: "Reserva no encontrada" });
    }
    trayecto_id = trayecto_id[0][0].id_trayecto;
    console.log("Trayecto ID de la reserva a eliminar:", trayecto_id);

    const [result_updated_trayecto] = await connection.query("UPDATE trayectos SET disponible = disponible + 1 WHERE id = ?", [trayecto_id]);
    const [result] = await connection.query("DELETE FROM reservas WHERE id_reserva = ?", [id]);
    if (result.affectedRows === 0) {
        return res.status(404).send({ status: "Error", message: "Reserva no encontrada" });
    }

    return res.status(200).send({ status: "Success", message: "Reserva eliminada correctamente" });
}
export const ReservaController = {
    addReserva,
    deleteReserva,
    getReservasByTravelId,
    obtenerMisReservas
}