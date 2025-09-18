import {database} from "../database.js";
import { TrayectosSchema } from "../schemas/trayecto.js";
async function crearTrayecto(req, res) {

    //Se valida si exite la propiedad fecha
    let date = null
    try {
        date = new Date(req.body.fecha);
        if (isNaN(date.getTime())) {
            return res.status(400).send({status: "Error", message: "La propiedad fecha debe ser una fecha válida en formato YYYY-MM-DD"});
        }
    } catch (error) {
        return res.status(400).send({status: "Error", message: "La propiedad fecha debe ser una fecha válida en formato YYYY-MM-DD"});
    }
    const validation = TrayectosSchema.validateTrayectoSinId(req.body)

    if (!validation.success) {
        return res.status(400).send({status: "Error", message: JSON.parse(validation.error.message)});
    }
    


    let { origen, destino, fecha, hora, plazas, conductor, disponible } = validation.data;
    if(!disponible){
        disponible = plazas
    }
    const connection = await database.getConnection();
    // Combina fecha y hora en un solo objeto Date en UTC
    let fechaHoraSQL
    try {
    fechaHoraSQL = convertirFechaHoraUTC(fecha, hora);

    } catch (error) {
        console.error("Error al procesar la fecha y hora:", error);
        return res.status(400).send({status: "Error", message: "Error al procesar la fecha y hora"});
    }

    // Inserta el trayecto en la base de datos
    const [result] = await connection.query(
        "INSERT INTO trayectos (origen, destino, hora, plazas, conductor, disponible) VALUES (?, ?, ?, ?, ?, ?)",
        [origen, destino, fechaHoraSQL, plazas, conductor, disponible]
    );
    console.log(result)
    const insertedId = result.insertId;
    if (!insertedId) {
        return res.status(500).send({status: "Error", message: "Error al crear el trayecto"});
    }
    const newTrayecto = { id: insertedId, origen, destino, fecha, hora, plazas, conductor, disponible };
    // Devuelve el nuevo trayecto creado
    // return res.status(201).json(newTrayecto);

    // return res.status(201).send({status: "Success", message: JSON.stringify(validation.data)});
    return res.status(201).send({
        status: "Success", 
        message: "Trayecto creado correctamente", 
        trayecto: newTrayecto
    });
}


function convertirFechaHoraUTC(fecha, hora) {
    let fechaHoraSQL;
     const fechaHora = new Date(`${fecha.trim()}T${hora.trim()}:00.000Z`);
    console.log(fechaHora);
    // Formatea a string compatible con SQL DATETIME (YYYY-MM-DD HH:MM:SS)
    fechaHoraSQL = fechaHora.toISOString().slice(0, 19).replace('T', ' ');
    return fechaHoraSQL;
}

async function obtenerTrayectos(req, res) {
    const connection = await database.getConnection();
    const [rows] = await connection.query("SELECT * FROM trayectos");
    return res.status(200).json(rows);
}

async function obtenerTrayectoPorId(req, res) {
    const { id } = req.params;
    const connection = await database.getConnection();
    const [rows] = await connection.query("SELECT * FROM trayectos WHERE id = ?", [id]);
    if (rows.length === 0) {
        return res.status(404).send({status: "Error", message: "Trayecto no encontrado"});
    }
    const trayecto = rows[0];
    const fechaHora = new Date(trayecto.hora).toLocaleString();
    console.log(fechaHora);
    return res.status(200).json({...trayecto, hora: fechaHora});
}

async function actualizarTrayecto(req, res) {
    const { id } = req.params;
    const validation = TrayectosSchema.validateTrayectoPartial(req.body);

    if (!validation.success) {
        return res.status(400).send({ status: "Error", message: JSON.parse(validation.error.message) });
    }

    const data = validation.data;
    console.log(data);
    const connection = await database.getConnection();

    // Check if there are any fields to update
    if (Object.keys(data).length === 0) {
        return res.status(400).send({ status: "Error", message: "No se proporcionaron campos para actualizar." });
    }

    // Build the dynamic SQL query
    const setClauses = [];
    const values = [];

    // Combine 'fecha' and 'hora' if both are provided
    if (data.fecha && data.hora) {
        try {
            const fechaHoraSQL = convertirFechaHoraUTC(data.fecha, data.hora);
            setClauses.push("hora = ?");
            values.push(fechaHoraSQL);
            delete data.fecha; // Remove from the data object to avoid processing twice
            delete data.hora;
        } catch (error) {
            console.error("Error al procesar la fecha y hora:", error);
            return res.status(400).send({ status: "Error", message: "Error al procesar la fecha y hora." });
        }
    } else if (data.fecha || data.hora) {
        // If only one is provided, it's an error in this context
        return res.status(400).send({ status: "Error", message: "Debe proporcionar tanto la fecha como la hora para actualizar la hora del trayecto." });
    }

    // Iterate over the rest of the validated data to build the query
    for (const key in data) {
        // We use backticks for column names to avoid conflicts with reserved words, just in case
        setClauses.push(`\`${key}\` = ?`);
        values.push(data[key]);
    }
    
    // Construct the final query string
    const query = `UPDATE trayectos SET ${setClauses.join(', ')} WHERE id = ?`;
    values.push(id); // Add the ID at the end for the WHERE clause

    try {
        const result = await connection.query(query, values);
        if (result[0].affectedRows === 0) {
            return res.status(404).send({ status: "Error", message: "Trayecto no encontrado" });
        }
        return res.sendStatus(204);
    } catch (error) {
        console.error("Error al ejecutar la consulta de actualización:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al actualizar el trayecto." });
    } finally {
        // connection.release(); // Always release the connection
    }
}

async function patchTrayecto(req, res){
    const { id } = req.params;
    const validation = TrayectosSchema.validateTrayectoSinId(req.body)
    if (!validation.success) {
        return res.status(400).send({status: "Error", message: JSON.parse(validation.error.message)});
    }
    const { origen, destino, fecha, hora, plazas, conductor } = validation.data;
    const connection = await database.getConnection();
    const result = await connection.query(
        "UPDATE trayectos SET origen = COALESCE(?, origen), destino = COALESCE(?, destino), fecha = COALESCE(?, fecha), hora = COALESCE(?, hora), plazas = COALESCE(?, plazas), conductor = COALESCE(?, conductor) WHERE id = ?",
        [origen, destino, fecha, hora, plazas, conductor, id]
    );
    if (result[0].affectedRows === 0) {
        return res.status(404).send({status: "Error", message: "Trayecto no encontrado"});
    }
    return res.sendStatus(204);
}

async function eliminarTrayecto(req, res){
    const { id } = req.params;
    const connection = await database.getConnection();
    const result = await connection.query("DELETE FROM trayectos WHERE id = ?", [id]);
    if (result[0].affectedRows === 0) {
        return res.status(404).send({status: "Error", message: "Trayecto no encontrado"});
    }
    return res.sendStatus(204);
}

async function buscarTrayectos(req, res) {
    try {
        const { origin, destination, date, passengers } = req.query;
        console.log(origin, destination, date, passengers);
        const o = (origin ?? "").toString().trim();
        const d = (destination ?? "").toString().trim();
        const f = (date ?? "").toString().trim();
        const pRaw = (passengers ?? "").toString().trim();

        if (!o || !d || !f || !pRaw) {
            return res.status(400).send({
                status: "Error",
                message: "Parámetros requeridos: origin/origen, destination/destino, date/fecha (YYYY-MM-DD), passengers/pasajeros"
            });
        }

        // Validar fecha (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
            return res.status(400).send({ status: "Error", message: "La fecha debe tener formato YYYY-MM-DD" });
        }
        const dateObj = new Date(f);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).send({ status: "Error", message: "La fecha no es válida" });
        }

        // Validar pasajeros
        const seats = parseInt(pRaw, 10);
        if (Number.isNaN(seats) || seats < 1) {
            return res.status(400).send({ status: "Error", message: "El número de pasajeros debe ser un entero >= 1" });
        }

        const connection = await database.getConnection();
        const [rows] = await connection.query(
            "SELECT * FROM trayectos WHERE origen = ? AND destino = ? AND DATE(hora) = ? AND disponible >= ? ORDER BY hora ASC",
            [o, d, f, seats]
        );

        return res.status(200).json(rows);
    } catch (error) {
        console.error("Error en buscarTrayectos:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al buscar trayectos" });
    }
}

export const TrayectosController = {
    crearTrayecto,
    obtenerTrayectos,
    eliminarTrayecto, 
    obtenerTrayectoPorId,
    actualizarTrayecto,
    patchTrayecto,
    buscarTrayectos
}