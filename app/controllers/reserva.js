import { ReservaSchema } from "../schemas/reserva.js";
import {database} from "../database.js";
async function addReserva(req, res) {
    const validation = ReservaSchema.validateReservaSinId(req.body);

    if (!validation.success) {
        return res.status(400).send({ status: "Error", message: JSON.parse(validation.error.message) });
    }

    const { username, trayecto_id } = validation.data;
    // Aquí iría la lógica para agregar la reserva a la base de datos
    console.log("Agregar reserva para el usuario:", username, "en el trayecto ID:", trayecto_id);
    const connection = await database.getConnection();

    let disponibilidad = await connection.query("SELECT disponible FROM trayectos WHERE id = ?", [trayecto_id]);
    if (disponibilidad[0].length === 0) {
        return res.status(404).send({ status: "Error", message: "Trayecto no encontrado" });
    }
    
    disponibilidad = disponibilidad[0][0].disponible;
    console.log("Disponibilidad del trayecto:", disponibilidad);
    // Si no hay disponibilidad, devolver un error
    

    if (disponibilidad === 0) {
        return res.status(404).send({ status: "Error", message: "El trayecto no tiene asiento libres" });
    }

    // Inserta la reserva en la base de datos
    let result= null;
    try{

    [result] = await connection.query(
        "INSERT INTO reservas (username, id_trayecto) VALUES (?, ?)",
        [username, trayecto_id]
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
    const newReserva = { id: result.insertId, username, trayecto_id };

    return res.status(201).send({
        status: "Success",
        message: "Reserva creada correctamente",
        reserva: newReserva
    });


}

async function getReservasByTravelId(req,res){
    const { travelId } = req.params;
    const connection = await database.getConnection();
    let pasajerosList = await connection.query("SELECT * FROM reservas WHERE id_trayecto = ?", [travelId]);
    if(pasajerosList[0].length === 0){
        return res.status(404).send({ status: "Error", message: "No se ha encontrado este trayecto o todavia no tiene reservas" });

    }
    pasajerosList = pasajerosList[0]

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
    getReservasByTravelId
}