import { database } from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";
import { OilPriceProvider } from "../providers/precio-oil.js";
import { TrayectosSchema } from "../schemas/trayecto.js";
import { DateUtils } from "../utils/date.js";
import { notifyTrayectoFinalizado } from "../cron-jobs.js";
import { methods as cryptoMethods } from "../utils/crypto.js";
import dotenv from "dotenv";

dotenv.config();
const MESSAGES_URL = process.env.MESSAGES_URL;

const SEARCH_DISTANCE_KM = 0.2; // 200 metros = 0.2 km
const EARTH_RADIUS_KM = 6371;

function getAuthHeaders(req) {
  const authHeader = req.headers?.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;
  const cookieToken = req.cookies?.access_token;
  const token = bearerToken || cookieToken;
  if (!token) return { token: null, headers: {} };

  const headers = {};
  if (bearerToken) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Cookie = `access_token=${token}`;
  }
  return { token, headers };
}

async function hasUserRatedTrayecto(connection, userId, trayectoId) {
  if (!userId || !trayectoId) return false;
  const [rows] = await connection.query(
    "SELECT 1 FROM comments WHERE id_trayecto = ? AND user_id_commentator = ? LIMIT 1",
    [trayectoId, userId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getRatedTrayectoIdsForUser(connection, userId, trayectoIds) {
  if (!userId) return new Set();
  const ids = (trayectoIds ?? [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (ids.length === 0) return new Set();

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT DISTINCT id_trayecto FROM comments WHERE user_id_commentator = ? AND id_trayecto IN (${placeholders})`,
    [userId, ...ids],
  );
  return new Set(
    (rows ?? [])
      .map((r) => Number(r.id_trayecto))
      .filter((x) => Number.isFinite(x)),
  );
}

function parsePreferenceValue(valueType, raw) {
  const value = raw == null ? "" : String(raw);
  switch (valueType) {
    case "boolean":
      return value === "1" || value.toLowerCase() === "true";
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case "text":
    case "enum":
      return value;
    default:
      return value;
  }
}

async function getTrayectos(req, res) {
  try {
    const connection = await database.getConnection();
    const [trayectos] = await connection.query(
      "SELECT * FROM trayectos WHERE status != 'cancelado'",
    );

    // If there are no trayectos, return empty array
    if (!trayectos || trayectos.length === 0) {
      return res.status(200).send({ status: "Success", trayectos: [] });
    }

    // Get all unique driver ids
    const driverIds = [...new Set(trayectos.map((t) => t.conductor))];

    let preferencesByDriver = {};
    if (driverIds.length > 0) {
      const [preferences] = await connection.query(
        `SELECT 
          d.pref_key, 
          d.value_type, 
          u.user_id, 
          u.value
        FROM user_preferences u
        JOIN preference_definitions d ON u.pref_key = d.pref_key
        WHERE u.user_id IN (?) AND d.is_active = 1`,
        [driverIds],
      );

      // Group preferences by user_id
      for (const p of preferences) {
        if (!preferencesByDriver[p.user_id]) {
          preferencesByDriver[p.user_id] = {};
        }
        preferencesByDriver[p.user_id][p.pref_key] = parsePreferenceValue(
          p.value_type,
          p.value,
        );
      }
    }

    // Attach driverPreferences to each trayecto
    const trayectosWithPreferences = trayectos.map((t) => ({
      ...t,
      driverPreferences: preferencesByDriver[t.conductor] || {},
    }));

    return res
      .status(200)
      .send({ status: "Success", trayectos: trayectosWithPreferences });
  } catch (error) {
    console.error("Error en getTrayectos:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error obteniendo trayectos" });
  }
}

async function crearTrayecto(req, res) {
  console.log(
    "[crearTrayecto] Inicio — body recibido:",
    JSON.stringify(req.body),
  );
  //Se valida si exite la propiedad fecha
  let date = null;

  try {
    date = new Date(req.body.fecha);
    if (isNaN(date.getTime())) {
      return res.status(400).send({
        status: "Error",
        message:
          "La propiedad fecha debe ser una fecha válida en formato YYYY-MM-DD",
      });
    }
  } catch (error) {
    return res.status(400).send({
      status: "Error",
      message:
        "La propiedad fecha debe ser una fecha válida en formato YYYY-MM-DD",
    });
  }
  if (!req.body.conductor) {
    req.body.conductor = req.user.id;
    console.log(
      "[crearTrayecto] conductor no enviado, usando req.user.id:",
      req.body.conductor,
    );
  }
  const validation = TrayectosSchema.validateTrayectoSinId(req.body);
  console.log(
    "[crearTrayecto] Validación schema:",
    validation.success ? "OK" : "FALLO",
  );

  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  let {
    origen,
    destino,
    fecha,
    hora,
    plazas,
    conductor,
    disponible,
    precio,
    routeIndex,
  } = validation.data;
  let conductor_id = conductor;
  console.log(
    `[crearTrayecto] Conductor ${conductor} crea trayecto: ${origen} -> ${destino} | ${fecha} ${hora} | plazas=${plazas}`,
  );
  if (!disponible) {
    disponible = plazas;
    console.log(
      "[crearTrayecto] disponible no enviado, usando plazas:",
      disponible,
    );
  }
  console.log("[crearTrayecto] Obteniendo conexión a BD...");
  const connection = await database.getConnection();
  console.log("[crearTrayecto] Conexión BD obtenida");
  // Combina fecha y hora en un solo objeto Date en UTC
  let fechaHoraSQL;
  try {
    fechaHoraSQL = convertirFechaHoraUTC(fecha, hora);
    console.log("[crearTrayecto] Fecha/hora UTC convertida:", fechaHoraSQL);
  } catch (error) {
    console.error("[crearTrayecto] Error al procesar la fecha y hora:", error);
    return res
      .status(400)
      .send({ status: "Error", message: "Error al procesar la fecha y hora" });
  }

  if (!routeIndex) {
    routeIndex = 0;
  }
  // Inserta el trayecto en la base de datos
  let result = null;
  let originDetails;
  let destinationDetails;
  try {
    console.log("[crearTrayecto] Geocodificando origen:", origen);
    originDetails = await GoogleMapsProvider.geocodeAddressDetails(origen);
    console.log(
      "[crearTrayecto] Origen geocodificado:",
      JSON.stringify(originDetails),
    );
    console.log("[crearTrayecto] Geocodificando destino:", destino);
    destinationDetails =
      await GoogleMapsProvider.geocodeAddressDetails(destino);
    console.log(
      "[crearTrayecto] Destino geocodificado:",
      JSON.stringify(destinationDetails),
    );
  } catch (e) {
    console.error(
      "[crearTrayecto] Error geocodificando direcciones:",
      e.message,
    );
    return res.status(400).send({
      status: "Error",
      message:
        "No se ha podido geocodificar las direcciones. Compruebe la apikey de Google Maps ",
    });
  }

  const provinceForPricing =
    originDetails.province || destinationDetails.province;
  console.log("[crearTrayecto] Provincia para pricing:", provinceForPricing);
  if (!provinceForPricing) {
    return res.status(400).send({
      status: "Error",
      message: "No se pudo determinar la provincia para calcular el precio",
    });
  }

  try {
    console.log(
      "[crearTrayecto] Consultando precio gasoil para provincia:",
      provinceForPricing,
    );
    const gasoilPrice =
      await OilPriceProvider.getGasoilAveragePriceByProvinciaNombre(
        provinceForPricing,
      );
    precio = Math.ceil(gasoilPrice);
    console.log(
      "[crearTrayecto] Precio gasoil obtenido:",
      gasoilPrice,
      "-> precio final:",
      precio,
    );
  } catch (error) {
    console.error(
      "[crearTrayecto] Error al calcular el precio por provincia:",
      error,
    );
    return res.status(502).send({
      status: "Error",
      message: "No se pudo calcular el precio del gasoil para el trayecto",
    });
  }

  try {
    console.log("[crearTrayecto] Insertando trayecto en BD...");
    [result] = await connection.query(
      "INSERT INTO trayectos (origen, destino, hora, plazas, conductor, disponible, precio, origen_lat, origen_lng, destino_lat, destino_lng, routeIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        origen,
        destino,
        fechaHoraSQL,
        plazas,
        conductor,
        disponible,
        precio,
        originDetails.lat,
        originDetails.lng,
        destinationDetails.lat,
        destinationDetails.lng,
        routeIndex,
      ],
    );
  } catch (error) {
    console.error(
      "[crearTrayecto] Error al insertar en BD. Código:",
      error.code,
      "Mensaje:",
      error.message,
    );
    switch (error.code) {
      case "ER_NO_REFERENCED_ROW_2":
        return res
          .status(400)
          .send({ status: "Error", message: "El conductor no existe" });
      case "ER_DUP_ENTRY":
        return res.status(400).send({
          status: "Error",
          message: "Ya existe un trayecto con la misma fecha y hora",
        });
      default:
        return res
          .status(400)
          .send({ status: "Error", message: "Error al insertar el trayecto" });
    }
  }
  const insertedId = result.insertId;
  console.log("[crearTrayecto] Trayecto insertado con ID:", insertedId);
  if (!insertedId) {
    return res
      .status(500)
      .send({ status: "Error", message: "Error al crear el trayecto" });
  }

  // Fetch conductor name to return in response
  console.log("[crearTrayecto] Obteniendo nombre del conductor:", conductor);
  const [userRows] = await connection.query(
    "SELECT name FROM users WHERE id = ?",
    [conductor],
  );
  const decryptedUser = cryptoMethods.decryptFields(userRows[0], ["name"]);
  const conductorName = decryptedUser?.name || "Desconocido";
  console.log("[crearTrayecto] Nombre conductor:", conductorName);

  const newTrayecto = {
    id: insertedId,
    origen,
    destino,
    fecha,
    hora,
    plazas,
    conductor: conductorName,
    conductor_id,
    precio,
  };

  if (!MESSAGES_URL) {
    console.error("[crearTrayecto] MESSAGES_URL no configurado — rollback");
    try {
      await connection.query("DELETE FROM trayectos WHERE id = ?", [
        insertedId,
      ]);
    } catch (e) {
      console.error(
        "Error haciendo rollback del trayecto tras MESSAGES_URL missing:",
        e,
      );
    }
    return res.status(500).send({
      status: "Error",
      message: "MESSAGES_URL no configurado",
    });
  }

  try {
    console.log(
      "[crearTrayecto] Creando chat en MESSAGES_URL:",
      `${MESSAGES_URL}/api/chats`,
    );
    const { headers } = getAuthHeaders(req);
    const baseHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    const createChat = async (payload) => {
      const response = await fetch(`${MESSAGES_URL}/api/chats`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = body?.message ?? "Error al crear el chat del trayecto";
        const err = new Error(msg);
        err.details = body;
        throw err;
      }
      return body;
    };

    await createChat({
      name: `Viaje a '${destino}'`,
      trip_id: insertedId,
      admin_id: req.user?.userId,
      participant_ids: [],
    });
    console.log(
      "[crearTrayecto] Chat creado correctamente para trayecto ID:",
      insertedId,
    );
  } catch (error) {
    console.error(
      "[crearTrayecto] Error creando chat para el trayecto:",
      error,
    );
    try {
      await connection.query("DELETE FROM trayectos WHERE id = ?", [
        insertedId,
      ]);
    } catch (e) {
      console.error(
        "Error haciendo rollback del trayecto tras fallo de chat:",
        e,
      );
    }
    return res.status(502).send({
      status: "Error",
      message: error?.message ?? "Error al crear el chat del trayecto",
    });
  }

  console.log(
    "[crearTrayecto] Trayecto creado correctamente. ID:",
    insertedId,
    "Precio:",
    precio,
  );
  return res.status(201).send({
    status: "Success",
    message: "Trayecto creado correctamente",
    trayecto: newTrayecto,
  });
}

function convertirFechaHoraUTC(fecha, hora) {
  let fechaHoraSQL;
  const fechaHora = new Date(`${fecha.trim()}T${hora.trim()}:00.000Z`);
  // Formatea a string compatible con SQL DATETIME (YYYY-MM-DD HH:MM:SS)
  fechaHoraSQL = fechaHora.toISOString().slice(0, 19).replace("T", " ");
  return fechaHoraSQL;
}

async function obtenerTrayectos(req, res) {
  const connection = await database.getConnection();
  const [rows] = await connection.query("SELECT * FROM trayectos");
  const userId = req.user?.id;

  // Obtener detalles de conductores (nombre e imagen) usando sus IDs
  const conductorIds = [...new Set(rows.map((t) => t.conductor))];
  const usersMap = new Map();

  if (conductorIds.length > 0) {
    const placeholders = conductorIds.map(() => "?").join(",");
    const [users] = await connection.query(
      `SELECT id, name, img_perfil FROM users WHERE id IN (${placeholders})`,
      conductorIds,
    );
    users.forEach((u) =>
      usersMap.set(u.id, cryptoMethods.decryptFields(u, ["name"])),
    );
  }

  const ratedIds = await getRatedTrayectoIdsForUser(
    connection,
    userId,
    rows.map((t) => t.id),
  );
  const data = rows.map((t) => {
    const user = usersMap.get(t.conductor);
    return {
      ...t,
      conductor: user?.name || "Desconocido",
      conductor_id: t.conductor,
      img_perfil: user?.img_perfil || null,
      valorado: ratedIds.has(Number(t.id)),
    };
  });
  return res.status(200).json(data);
}

async function obtenerTrayectoPorId(req, res) {
  const { id } = req.params;
  const connection = await database.getConnection();
  const [rows] = await connection.query(
    "SELECT * FROM trayectos WHERE id = ?",
    [id],
  );

  if (rows.length === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }
  const trayecto = rows[0];
  const [userRows] = await connection.query(
    "SELECT name, img_perfil FROM users WHERE id = ?",
    [trayecto.conductor],
  );
  const conductorUser = cryptoMethods.decryptFields(userRows[0], ["name"]);
  const conductorName = conductorUser?.name || "Desconocido";
  const imgPerfil = conductorUser?.img_perfil;

  const fecha = new Date(trayecto.hora).toDateString();
  const fechaHora = new Date(trayecto.hora + ".000Z").toISOString();
  const userId = req.user?.id;
  const valorado = await hasUserRatedTrayecto(connection, userId, trayecto.id);

  // Get driver's preferences
  let driverPreferences = {};
  const [preferences] = await connection.query(
    `SELECT 
      d.pref_key, 
      d.value_type, 
      u.value
    FROM user_preferences u
    JOIN preference_definitions d ON u.pref_key = d.pref_key
    WHERE u.user_id = ? AND d.is_active = 1`,
    [trayecto.conductor],
  );
  for (const p of preferences) {
    driverPreferences[p.pref_key] = parsePreferenceValue(p.value_type, p.value);
  }

  return res.status(200).json({
    ...trayecto,
    conductor: conductorName,
    conductor_id: trayecto.conductor,
    hora: fechaHora,
    fecha,
    img_perfil: imgPerfil,
    valorado,
    driverPreferences,
  });
}

async function obtenerTrayectosPorConductor(req, res) {
  const { id } = req.params;
  const connection = await database.getConnection();
  const [rows] = await connection.query(
    "SELECT * FROM trayectos WHERE conductor = ?",
    [id],
  );
  let trayectos = await Promise.all(
    rows.map(async (trayecto) => {
      const [userRows] = await connection.query(
        "SELECT name, img_perfil FROM users WHERE id = ?",
        [trayecto.conductor],
      );
      const conductorUser = cryptoMethods.decryptFields(userRows[0], ["name"]);
      return {
        ...trayecto,
        conductor: conductorUser?.name || "Desconocido",
        conductor_id: trayecto.conductor,
        img_perfil: conductorUser?.img_perfil,
      };
    }),
  );
  const currentuserId = req.user?.id;
  const ratedIds = await getRatedTrayectoIdsForUser(
    connection,
    currentuserId,
    trayectos.map((t) => t.id),
  );
  trayectos = trayectos.map((t) => ({
    ...t,
    valorado: ratedIds.has(Number(t.id)),
  }));
  return res.status(200).json(trayectos);
}

async function obtenerMisTrayectos(req, res) {
  const { id } = req.user;
  const connection = await database.getConnection();
  const [rows] = await connection.query(
    "SELECT * FROM trayectos WHERE conductor = ?",
    [id],
  );

  // Obtener mi nombre e imagen (aunque ya los tenga en req.user, para consistencia o datos actualizados)
  const [userRows] = await connection.query(
    "SELECT name, img_perfil FROM users WHERE id = ?",
    [id],
  );
  const myUser = cryptoMethods.decryptFields(userRows[0], ["name"]);
  const myName = myUser?.name || "Yo";
  const myImg = myUser?.img_perfil;

  const ratedIds = await getRatedTrayectoIdsForUser(
    connection,
    id,
    rows.map((t) => t.id),
  );
  const data = rows.map((t) => ({
    ...t,
    conductor: myName,
    conductor_id: t.conductor,
    img_perfil: myImg,
    valorado: ratedIds.has(Number(t.id)),
  }));
  return res.status(200).json(data);
}

async function finalizarTrayecto(req, res) {
  const { id } = req.params;
  const trayectoId = Number(id);
  if (!Number.isFinite(trayectoId) || trayectoId <= 0) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const connection = await database.getConnection();
  const [rows] = await connection.query(
    "SELECT id, origen, destino, hora, conductor, status FROM trayectos WHERE id = ?",
    [trayectoId],
  );
  const trayecto = rows?.[0];
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (trayecto.conductor !== userId) {
    return res.status(401).send({
      status: "Error",
      message: "No eres el conductor de este trayecto",
    });
  }

  const status = String(trayecto.status ?? "").toLowerCase();
  if (status !== "en curso") {
    return res.status(409).send({
      status: "Error",
      message: "El trayecto no está en curso",
    });
  }

  const [result] = await connection.query(
    "UPDATE trayectos SET status = 'finalizado' WHERE id = ? AND status = 'en curso'",
    [trayectoId],
  );

  if (!result?.affectedRows) {
    return res.status(409).send({
      status: "Error",
      message: "No se pudo finalizar el trayecto (estado no válido)",
    });
  }

  try {
    await notifyTrayectoFinalizado(connection, trayecto);
  } catch (e) {
    console.error("Error notificando trayecto finalizado:", e);
  }

  return res.status(200).send({
    status: "Success",
    message: "Trayecto finalizado y notificado correctamente",
  });
}

async function actualizarTrayecto(req, res) {
  const { id } = req.params;
  const validation = TrayectosSchema.validateTrayectoPartial(req.body);

  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const data = validation.data;
  const connection = await database.getConnection();

  // Check if there are any fields to update
  if (Object.keys(data).length === 0) {
    return res.status(400).send({
      status: "Error",
      message: "No se proporcionaron campos para actualizar.",
    });
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
      return res.status(400).send({
        status: "Error",
        message: "Error al procesar la fecha y hora.",
      });
    }
  } else if (data.fecha || data.hora) {
    // If only one is provided, it's an error in this context
    return res.status(400).send({
      status: "Error",
      message:
        "Debe proporcionar tanto la fecha como la hora para actualizar la hora del trayecto.",
    });
  }

  // Iterate over the rest of the validated data to build the query
  for (const key in data) {
    // We use backticks for column names to avoid conflicts with reserved words, just in case
    setClauses.push(`\`${key}\` = ?`);
    values.push(data[key]);
  }

  // Construct the final query string
  const query = `UPDATE trayectos SET ${setClauses.join(", ")} WHERE id = ?`;
  values.push(id); // Add the ID at the end for the WHERE clause

  try {
    const result = await connection.query(query, values);
    if (result[0].affectedRows === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error("Error al ejecutar la consulta de actualización:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al actualizar el trayecto.",
    });
  } finally {
    // connection.release(); // Always release the connection
  }
}

async function patchTrayecto(req, res) {
  const { id } = req.params;
  const validation = TrayectosSchema.validateTrayectoSinId(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }
  const {
    origen,
    destino,
    fecha,
    hora,
    plazas,
    conductor,
    precio,
    routeIndex,
  } = validation.data;

  const connection = await database.getConnection();
  let fechaHora = convertirFechaHoraUTC(fecha, hora);

  const originalTrayect = await connection.query(
    "SELECT * FROM trayectos WHERE id = ?",
    [id],
  );
  const originalPlazas = originalTrayect[0][0].plazas;
  const originalDisponible = originalTrayect[0][0].disponible;

  const originalOrigin = originalTrayect[0][0].origen;
  const originalDestination = originalTrayect[0][0].destino;

  if (originalOrigin !== origen) {
    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    const updateOrigin = await connection.query(
      "UPDATE trayectos SET origen_lat = ?, origen_lng = ? WHERE id = ?",
      [originCoords.lat, originCoords.lng, id],
    );
  }
  if (originalDestination !== destino) {
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    const updateDestination = await connection.query(
      "UPDATE trayectos SET destino_lat = ?, destino_lng = ? WHERE id = ?",
      [destinationCoords.lat, destinationCoords.lng, id],
    );
  }

  if (originalPlazas < plazas) {
    let diferencia = originalDisponible + (plazas - originalPlazas);
    const updateDisponible = await connection.query(
      "UPDATE trayectos SET disponible = ? WHERE id = ?",
      [diferencia, id],
    );
  } else {
    let diferencia = originalDisponible - (originalPlazas - plazas);
    const updateDisponible = await connection.query(
      "UPDATE trayectos SET disponible = ? WHERE id = ?",
      [diferencia, id],
    );
  }

  const result = await connection.query(
    "UPDATE trayectos SET origen = COALESCE(?, origen), destino = COALESCE(?, destino), hora = COALESCE(?, hora), plazas = COALESCE(?, plazas), conductor = COALESCE(?, conductor), precio = COALESCE(?, precio), routeIndex = COALESCE(?, routeIndex) WHERE id = ?",
    [origen, destino, fechaHora, plazas, conductor, precio, routeIndex, id],
  );
  if (result[0].affectedRows === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }
  return res
    .status(204)
    .send({ status: "Success", message: "Trayecto actualizado correctamente" });
}

async function eliminarTrayecto(req, res) {
  const { id } = req.params;
  const connection = await database.getConnection();
  const result = await connection.query("DELETE FROM trayectos WHERE id = ?", [
    id,
  ]);
  if (result[0].affectedRows === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }
  return res.sendStatus(204);
}

async function buscarTrayectos(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "10", 10), 1),
      100,
    );
    const offset = (page - 1) * limit;
    const { origin, destination, date, passengers } = req.query;
    const o = (origin ?? "").toString().trim();
    const d = (destination ?? "").toString().trim();
    const f = (date ?? "").toString().trim();
    const pRaw = (passengers ?? "").toString().trim();

    if (!o || !d || !f || !pRaw) {
      return res.status(400).send({
        status: "Error",
        message:
          "Parámetros requeridos: origin/origen, destination/destino, date/fecha (YYYY-MM-DD), passengers/pasajeros",
      });
    }

    // Validar fecha (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return res.status(400).send({
        status: "Error",
        message: "La fecha debe tener formato YYYY-MM-DD",
      });
    }
    const dateObj = new Date(f);
    const fecha = dateObj.toISOString().split("T")[0];

    if (isNaN(dateObj.getTime())) {
      return res
        .status(400)
        .send({ status: "Error", message: "La fecha no es válida" });
    }

    // Validar pasajeros
    const seats = parseInt(pRaw, 10);
    if (Number.isNaN(seats) || seats < 1) {
      return res.status(400).send({
        status: "Error",
        message: "El número de pasajeros debe ser un entero >= 1",
      });
    }

    // 1. OBTENER COORDENADAS DEL USUARIO
    const userOriginCoords = await GoogleMapsProvider.geocodeAddress(o);
    const userDestCoords = await GoogleMapsProvider.geocodeAddress(d);

    // 2. Cálculo de bounding boxes y filtrado compatible con SQLite
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const deltaLatDeg = toDeg(SEARCH_DISTANCE_KM / EARTH_RADIUS_KM);
    const deltaLngDegOrigin = toDeg(
      SEARCH_DISTANCE_KM /
        (EARTH_RADIUS_KM * Math.cos(toRad(userOriginCoords.lat || 0.00001))),
    );
    const deltaLngDegDest = toDeg(
      SEARCH_DISTANCE_KM /
        (EARTH_RADIUS_KM * Math.cos(toRad(userDestCoords.lat || 0.00001))),
    );

    const originMinLat = userOriginCoords.lat - deltaLatDeg;
    const originMaxLat = userOriginCoords.lat + deltaLatDeg;
    const originMinLng = userOriginCoords.lng - deltaLngDegOrigin;
    const originMaxLng = userOriginCoords.lng + deltaLngDegOrigin;

    const destMinLat = userDestCoords.lat - deltaLatDeg;
    const destMaxLat = userDestCoords.lat + deltaLatDeg;
    const destMinLng = userDestCoords.lng - deltaLngDegDest;
    const destMaxLng = userDestCoords.lng + deltaLngDegDest;

    const connection = await database.getConnection();

    const baseSQL = `
            SELECT *
            FROM trayectos
            WHERE 
                origen_lat BETWEEN ? AND ? AND
                origen_lng BETWEEN ? AND ? AND
                destino_lat BETWEEN ? AND ? AND
                destino_lng BETWEEN ? AND ? AND
                DATE(hora) = ? AND 
                disponible >= ?
            ORDER BY hora ASC
        `;
    const baseParams = [
      originMinLat,
      originMaxLat,
      originMinLng,
      originMaxLng,
      destMinLat,
      destMaxLat,
      destMinLng,
      destMaxLng,
      f,
      seats,
    ];

    const [rows] = await connection.query(baseSQL, baseParams);
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return EARTH_RADIUS_KM * c;
    };
    let filtered = [];
    if (rows.length > 0) {
      filtered = rows.filter((t) => {
        const dOrigin = haversineKm(
          userOriginCoords.lat,
          userOriginCoords.lng,
          t.origen_lat,
          t.origen_lng,
        );
        const dDest = haversineKm(
          userDestCoords.lat,
          userDestCoords.lng,
          t.destino_lat,
          t.destino_lng,
        );
        return dOrigin <= SEARCH_DISTANCE_KM && dDest <= SEARCH_DISTANCE_KM;
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const pageSlice = filtered.slice(offset, offset + limit);

    let trayectosConImagen = await Promise.all(
      pageSlice.map(async (trayecto) => {
        const [userRows] = await connection.query(
          "SELECT name, img_perfil FROM users WHERE id = ?",
          [trayecto.conductor],
        );
        const conductorUser = cryptoMethods.decryptFields(userRows[0], [
          "name",
        ]);
        const img_perfil = conductorUser?.img_perfil || null;
        const name = conductorUser?.name || "Desconocido";
        return {
          ...trayecto,
          conductor: name,
          conductor_id: trayecto.conductor,
          img_perfil,
        };
      }),
    );

    const userId = req.user?.id;
    const ratedIds = await getRatedTrayectoIdsForUser(
      connection,
      userId,
      trayectosConImagen.map((t) => t.id),
    );
    trayectosConImagen = trayectosConImagen.map((t) => ({
      ...t,
      valorado: ratedIds.has(Number(t.id)),
    }));

    return res.status(200).json({
      data: trayectosConImagen,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error en buscarTrayectos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al buscar trayectos",
    });
  }
}

async function updateLatLong(req, res) {
  const connection = await database.getConnection();
  const [result] = await connection.query(
    "SELECT id,origen, destino FROM trayectos",
  );
  for (let i = 0; i < result.length; i++) {
    const { id, origen, destino } = result[i];
    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    await connection.query(
      "UPDATE trayectos SET origen_lat = ?, origen_lng = ?, destino_lat = ?, destino_lng = ? WHERE id = ?",
      [
        originCoords.lat,
        originCoords.lng,
        destinationCoords.lat,
        destinationCoords.lng,
        id,
      ],
    );
  }

  return res.sendStatus(204);
}

async function updateLatLongById(req, res) {
  const { id } = req.params;
  const connection = await database.getConnection();
  const [result] = await connection.query(
    "SELECT id,origen, destino FROM trayectos WHERE id = ?",
    [id],
  );
  const { origen, destino } = result[0];
  const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
  const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
  await connection.query(
    "UPDATE trayectos SET origen_lat = ?, origen_lng = ?, destino_lat = ?, destino_lng = ? WHERE id = ?",
    [
      originCoords.lat,
      originCoords.lng,
      destinationCoords.lat,
      destinationCoords.lng,
      id,
    ],
  );

  return res.sendStatus(204);
}

export const TrayectosController = {
  crearTrayecto,
  obtenerTrayectos: getTrayectos,
  eliminarTrayecto,
  obtenerTrayectoPorId,
  finalizarTrayecto,
  actualizarTrayecto,
  patchTrayecto,
  buscarTrayectos,
  obtenerTrayectosPorConductor,
  obtenerMisTrayectos,
  updateLatLong,
  updateLatLongById,
};
