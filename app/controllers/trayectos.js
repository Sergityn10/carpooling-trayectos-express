import {database} from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";
import { TrayectosSchema } from "../schemas/trayecto.js";
import { DateUtils } from "../utils/date.js";
const SEARCH_DISTANCE_KM = 0.2; // 200 metros = 0.2 km
const EARTH_RADIUS_KM = 6371;

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
    if(!req.body.conductor){
        req.body.conductor = req.user.username
    }
    const validation = TrayectosSchema.validateTrayectoSinId(req.body)

    if (!validation.success) {
        return res.status(400).send({status: "Error", message: JSON.parse(validation.error.message)});
    }
    


    let { origen, destino, fecha, hora, plazas, conductor, disponible,precio,routeIndex } = validation.data;
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
    let result = null

    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    try{
        [result] = await connection.query(
            "INSERT INTO trayectos (origen, destino, hora, plazas, conductor, disponible, precio, origen_lat, origen_lng, destino_lat, destino_lng, routeIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [origen, destino, fechaHoraSQL, plazas, conductor, disponible, precio, originCoords.lat, originCoords.lng, destinationCoords.lat, destinationCoords.lng, routeIndex]
        );
    }catch(error){
        switch(error.code){
            case "ER_NO_REFERENCED_ROW_2":
                return res.status(400).send({status: "Error", message: "El conductor no existe"});
            case "ER_DUP_ENTRY":
                return res.status(400).send({status: "Error", message: "Ya existe un trayecto con la misma fecha y hora"});
            default:
                return res.status(500).send({status: "Error", message: "Error al insertar el trayecto"});
        }
    }
    const insertedId = result.insertId;
    if (!insertedId) {
        return res.status(500).send({status: "Error", message: "Error al crear el trayecto"});
    }
    const newTrayecto = { id: insertedId, origen, destino, fecha, hora, plazas, conductor, disponible };

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
    const img_perfil = await connection.query("SELECT img_perfil FROM users WHERE username = ?", [trayecto.conductor]);
    const fecha = new Date(trayecto.hora).toDateString()
    console.log(fecha)
    const fechaHora = new Date(trayecto.hora + ".000Z").toISOString()
    return res.status(200).json({...trayecto, hora: fechaHora, fecha, img_perfil: img_perfil[0].img_perfil});
}

async function obtenerTrayectosPorConductor(req, res) {
    const { username } = req.params;
    const connection = await database.getConnection();
    const [rows] = await connection.query("SELECT * FROM trayectos WHERE conductor = ?", [username]);
    const trayectos = await Promise.all(rows.map( async trayecto => {
        const img_perfil = await connection.query("SELECT img_perfil FROM users WHERE username = ?", [trayecto.conductor]);
        return {...trayecto, img_perfil: img_perfil[0][0].img_perfil};
    }));
    return res.status(200).json(trayectos);
}

async function obtenerMisTrayectos(req, res) {
    const { username } = req.user;
    const connection = await database.getConnection();
    const [rows] = await connection.query("SELECT * FROM trayectos WHERE conductor = ?", [username]);
    return res.status(200).json(rows);
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
    console.log(req.body)
    const validation = TrayectosSchema.validateTrayectoSinId(req.body)
    if (!validation.success) {
        return res.status(400).send({status: "Error", message: JSON.parse(validation.error.message)});
    }
    const { origen, destino, fecha, hora, plazas, conductor, precio,routeIndex } = validation.data;

    const connection = await database.getConnection();
    let fechaHora = convertirFechaHoraUTC(fecha, hora)
    console.log(fechaHora)

    const originalTrayect = await connection.query("SELECT * FROM trayectos WHERE id = ?", [id]);
    const originalPlazas = originalTrayect[0][0].plazas;
    const originalDisponible = originalTrayect[0][0].disponible;

    const originalOrigin = originalTrayect[0][0].origen;
    const originalDestination = originalTrayect[0][0].destino;

    if(originalOrigin !== origen){
        const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
        const updateOrigin = await connection.query("UPDATE trayectos SET origen_lat = ?, origen_lng = ? WHERE id = ?", [originCoords.lat, originCoords.lng, id]);
    }
    if(originalDestination !== destino){
        const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
        const updateDestination = await connection.query("UPDATE trayectos SET destino_lat = ?, destino_lng = ? WHERE id = ?", [destinationCoords.lat, destinationCoords.lng, id]);

    }

    if(originalPlazas < plazas){
        let diferencia = originalDisponible + (plazas - originalPlazas);
        const updateDisponible = await connection.query("UPDATE trayectos SET disponible = ? WHERE id = ?", [diferencia, id]);
    }else{
        let diferencia = originalDisponible - (originalPlazas - plazas);
        const updateDisponible = await connection.query("UPDATE trayectos SET disponible = ? WHERE id = ?", [diferencia, id]);
    }

    const result = await connection.query(
        "UPDATE trayectos SET origen = COALESCE(?, origen), destino = COALESCE(?, destino), hora = COALESCE(?, hora), plazas = COALESCE(?, plazas), conductor = COALESCE(?, conductor), precio = COALESCE(?, precio), routeIndex = COALESCE(?, routeIndex) WHERE id = ?",
        [origen, destino, fechaHora, plazas, conductor, precio, routeIndex, id]
    );
    if (result[0].affectedRows === 0) {
        return res.status(404).send({status: "Error", message: "Trayecto no encontrado"});
    }
    return res.status(204).send({status: "Success", message: "Trayecto actualizado correctamente"});
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
        const fecha = dateObj.toISOString().split('T')[0];

        if (isNaN(dateObj.getTime())) {
            return res.status(400).send({ status: "Error", message: "La fecha no es válida" });
        }

        // Validar pasajeros
        const seats = parseInt(pRaw, 10);
        if (Number.isNaN(seats) || seats < 1) {
            return res.status(400).send({ status: "Error", message: "El número de pasajeros debe ser un entero >= 1" });
        }

        // 1. OBTENER COORDENADAS DEL USUARIO
        const userOriginCoords = await GoogleMapsProvider.geocodeAddress(o);
        const userDestCoords = await GoogleMapsProvider.geocodeAddress(d);

        // 2. CONSTRUIR CONSULTA SQL AVANZADA CON DISTANCIA (Fórmula del Coseno)
        // La Fórmula de Haversine es compleja para incrustar, esta aproximación funciona bien para distancias cortas.
        const distanceQuery = (userLat, userLng, dbLatCol, dbLngCol) => `
    (6371 * acos(
        cos(radians(${userLat})) * cos(radians(${dbLatCol})) *
        cos(radians(${dbLngCol}) - radians(${userLng})) +
        sin(radians(${userLat})) * sin(radians(${dbLatCol}))
    ))
`;

        const originDistanceSQL = distanceQuery(
            userOriginCoords.lat, 
            userOriginCoords.lng, 
            'origen_lat', 
            'origen_lng'
        );

        const destDistanceSQL = distanceQuery(
            userDestCoords.lat, 
            userDestCoords.lng, 
            'destino_lat', 
            'destino_lng'
        );

        const SQL = `
            SELECT 
                *, 
                ${originDistanceSQL} AS distance_from_origin,
                ${destDistanceSQL} AS distance_from_destination
            FROM trayectos
            WHERE 
                -- Filtro de Origen: La distancia calculada debe ser <= 0.2 km
                (${originDistanceSQL} <= ?) AND
                -- Filtro de Destino: La distancia calculada debe ser <= 0.2 km
                (${destDistanceSQL} <= ?) AND
                -- Filtro de Fecha
                DATE(hora) = ? AND 
                -- Filtro de Asientos
                disponible >= ? 
            ORDER BY distance_from_origin ASC, hora ASC
        `;
        
        // 5. PARÁMETROS: Pasar los valores necesarios para la fórmula y los filtros
        // Cada '?' en la función distanceQuery requiere 3 parámetros (lat, lng, lat).
        const params = [
            // Distancia Origen
            SEARCH_DISTANCE_KM, 
            // Distancia Destino
            SEARCH_DISTANCE_KM, 
            // Fecha (f ya está limpia como YYYY-MM-DD)
            f, 
            // Asientos requeridos
            seats
        ];


        const connection = await database.getConnection();
        // const [rows] = await connection.query(
        //     "SELECT * FROM trayectos WHERE origen = ? AND destino = ? AND DATE(hora) = ? AND disponible >= ? ORDER BY hora ASC",
        //     [o, d, f, seats]
        // );
        const [rows] = await connection.query(SQL, params);

        return res.status(200).json(rows);
    } catch (error) {
        console.error("Error en buscarTrayectos:", error);
        return res.status(500).send({ status: "Error", message: "Error en el servidor al buscar trayectos" });
    }
}

async function updateLatLong(req, res){
    const connection = await database.getConnection();
    const [result] = await connection.query("SELECT id,origen, destino FROM trayectos");
    console.log(result)
    for (let i = 0; i < result.length; i++) {
        const { id, origen, destino } = result[i];
        const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
        const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
        await connection.query("UPDATE trayectos SET origen_lat = ?, origen_lng = ?, destino_lat = ?, destino_lng = ? WHERE id = ?", [originCoords.lat, originCoords.lng, destinationCoords.lat, destinationCoords.lng, id]);
    }
    
    return res.sendStatus(204);
}

async function updateLatLongById(req, res){
    const { id } = req.params;
    const connection = await database.getConnection();
    const [result] = await connection.query("SELECT id,origen, destino FROM trayectos WHERE id = ?", [id]);
    const { origen, destino } = result[0];
    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    await connection.query("UPDATE trayectos SET origen_lat = ?, origen_lng = ?, destino_lat = ?, destino_lng = ? WHERE id = ?", [originCoords.lat, originCoords.lng, destinationCoords.lat, destinationCoords.lng, id]);
    
    return res.sendStatus(204);
}

export const TrayectosController = {
    crearTrayecto,
    obtenerTrayectos,
    eliminarTrayecto, 
    obtenerTrayectoPorId,
    actualizarTrayecto,
    patchTrayecto,
    buscarTrayectos,
    obtenerTrayectosPorConductor,
    obtenerMisTrayectos,
    updateLatLong,
    updateLatLongById
}