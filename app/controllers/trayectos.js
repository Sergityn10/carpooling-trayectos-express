import { randomUUID } from "crypto";
import { prisma } from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";
import { OilPriceProvider } from "../providers/precio-oil.js";
import { TrayectosSchema } from "../schemas/trayecto.js";
import { DateUtils } from "../utils/date.js";
import {
  notifyTrayectoFinalizado,
  notifyTrayectoEnCurso,
} from "../cron-jobs.js";
import { UsersAPI } from "../utils/users-api.js";
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

async function hasUserRatedTrayecto(userId, trayectoId) {
  if (!userId || !trayectoId) return false;
  const comment = await prisma.comment.findFirst({
    where: {
      id_trayecto: String(trayectoId),
      user_id_commentator: String(userId),
    },
    select: { id_comment: true },
  });
  return !!comment;
}

async function getRatedTrayectoIdsForUser(userId, trayectoIds) {
  if (!userId) return new Set();
  const ids = (trayectoIds ?? [])
    .map((x) => String(x))
    .filter((x) => x.length > 0);
  if (ids.length === 0) return new Set();

  const comments = await prisma.comment.findMany({
    where: {
      user_id_commentator: String(userId),
      id_trayecto: { in: ids },
    },
    select: { id_trayecto: true },
    distinct: ["id_trayecto"],
  });
  return new Set(comments.map((c) => String(c.id_trayecto)));
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
    const trayectos = await prisma.trayecto.findMany({
      where: { NOT: { status: "cancelado" } },
    });

    if (!trayectos || trayectos.length === 0) {
      return res.status(200).send({ status: "Success", trayectos: [] });
    }

    const driverIds = [...new Set(trayectos.map((t) => t.conductor))];

    let preferencesByDriver = {};
    if (driverIds.length > 0) {
      const preferences = await prisma.userPreference.findMany({
        where: {
          user_id: { in: driverIds },
          PreferenceDefinition: { is_active: 1 },
        },
        include: {
          PreferenceDefinition: {
            select: { pref_key: true, value_type: true },
          },
        },
      });

      for (const p of preferences) {
        if (!preferencesByDriver[p.user_id]) {
          preferencesByDriver[p.user_id] = {};
        }
        preferencesByDriver[p.user_id][p.PreferenceDefinition.pref_key] =
          parsePreferenceValue(p.PreferenceDefinition.value_type, p.value);
      }
    }

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

  const trayectoId = randomUUID();
  try {
    console.log(
      "[crearTrayecto] Insertando trayecto en BD con UUID:",
      trayectoId,
    );
    await prisma.trayecto.create({
      data: {
        id: trayectoId,
        origen,
        destino,
        hora: new Date(fechaHoraSQL),
        plazas,
        conductor,
        disponible,
        precio,
        origen_lat: originDetails.lat,
        origen_lng: originDetails.lng,
        destino_lat: destinationDetails.lat,
        destino_lng: destinationDetails.lng,
        routeIndex,
      },
    });
    result = true;
  } catch (error) {
    console.error(
      "[crearTrayecto] Error al insertar en BD. Código:",
      error.code,
      "Mensaje:",
      error.message,
    );
    switch (error.code) {
      case "P2003":
        return res
          .status(400)
          .send({ status: "Error", message: "El conductor no existe" });
      case "P2002":
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
  const insertedId = trayectoId;
  console.log("[crearTrayecto] Trayecto insertado con ID:", insertedId);
  if (!result) {
    return res
      .status(500)
      .send({ status: "Error", message: "Error al crear el trayecto" });
  }

  // Fetch conductor name from users microservice
  console.log("[crearTrayecto] Obteniendo nombre del conductor:", conductor);
  const conductorInfo = await UsersAPI.fetchUserPublicInfo(String(conductor));
  const conductorName = conductorInfo?.name || "Desconocido";
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
      await prisma.trayecto.delete({ where: { id: insertedId } });
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
      await prisma.trayecto.delete({ where: { id: insertedId } });
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
  const rows = await prisma.trayecto.findMany();
  const userId = req.user?.id;

  // Obtener detalles de conductores (nombre e imagen) desde el microservicio de usuarios
  const conductorIds = [...new Set(rows.map((t) => t.conductor))];
  const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
  const usersMap = new Map(usersList.map((u) => [u.id, u]));

  const ratedIds = await getRatedTrayectoIdsForUser(
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
      valorado: ratedIds.has(String(t.id)),
    };
  });
  return res.status(200).json(data);
}

async function obtenerTrayectoPorId(req, res) {
  const { id } = req.params;
  console.log("[obtenerTrayectoPorId] Buscando trayecto con id:", id);
  const trayecto = await prisma.trayecto.findUnique({
    where: { id },
  });
  console.log(
    "[obtenerTrayectoPorId] Trayecto encontrado:",
    trayecto ? "sí" : "no",
  );

  if (!trayecto) {
    console.log(
      "[obtenerTrayectoPorId] Trayecto no encontrado, devolviendo 404",
    );
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  console.log(
    "[obtenerTrayectoPorId] Trayecto data:",
    JSON.stringify(trayecto, null, 2),
  );

  console.log(
    "[obtenerTrayectoPorId] Fetching conductor info para:",
    String(trayecto.conductor),
  );
  const conductorInfo = await UsersAPI.fetchUserPublicInfo(
    String(trayecto.conductor),
  );
  console.log(
    "[obtenerTrayectoPorId] Conductor info:",
    conductorInfo ? JSON.stringify(conductorInfo) : "null",
  );
  const conductorName = conductorInfo?.name || "Desconocido";
  const imgPerfil = conductorInfo?.img_perfil;

  const fecha = new Date(trayecto.hora).toDateString();
  const fechaHora = new Date(trayecto.hora).toISOString();
  console.log(
    "[obtenerTrayectoPorId] fecha:",
    fecha,
    "| fechaHora:",
    fechaHora,
  );

  const userId = req.user?.id;
  console.log("[obtenerTrayectoPorId] userId del token:", userId);
  const valorado = await hasUserRatedTrayecto(userId, trayecto.id);
  console.log("[obtenerTrayectoPorId] valorado:", valorado);

  // Get driver's preferences
  let driverPreferences = {};
  console.log(
    "[obtenerTrayectoPorId] Buscando preferencias para conductor:",
    trayecto.conductor,
  );
  const preferences = await prisma.userPreference.findMany({
    where: {
      user_id: trayecto.conductor,
      PreferenceDefinition: { is_active: 1 },
    },
    include: {
      PreferenceDefinition: { select: { pref_key: true, value_type: true } },
    },
  });
  console.log(
    "[obtenerTrayectoPorId] Preferencias encontradas:",
    preferences.length,
    JSON.stringify(preferences, null, 2),
  );

  for (const p of preferences) {
    driverPreferences[p.PreferenceDefinition.pref_key] = parsePreferenceValue(
      p.PreferenceDefinition.value_type,
      p.value,
    );
  }
  console.log(
    "[obtenerTrayectoPorId] driverPreferences finales:",
    JSON.stringify(driverPreferences),
  );

  const response = {
    ...trayecto,
    conductor: conductorName,
    conductor_id: trayecto.conductor,
    hora: fechaHora,
    fecha,
    img_perfil: imgPerfil,
    valorado,
    driverPreferences,
  };
  console.log("[obtenerTrayectoPorId] Enviando respuesta 200");
  return res.status(200).json(response);
}

async function obtenerTrayectosPorConductor(req, res) {
  const { id } = req.params;
  const rows = await prisma.trayecto.findMany({
    where: { conductor: id },
  });
  let trayectos = await Promise.all(
    rows.map(async (trayecto) => {
      const conductorInfo = await UsersAPI.fetchUserPublicInfo(
        String(trayecto.conductor),
      );
      return {
        ...trayecto,
        conductor: conductorInfo?.name || "Desconocido",
        conductor_id: trayecto.conductor,
        img_perfil: conductorInfo?.img_perfil,
      };
    }),
  );
  const currentuserId = req.user?.id;
  const ratedIds = await getRatedTrayectoIdsForUser(
    currentuserId,
    trayectos.map((t) => t.id),
  );
  trayectos = trayectos.map((t) => ({
    ...t,
    valorado: ratedIds.has(String(t.id)),
  }));
  return res.status(200).json(trayectos);
}

async function obtenerMisTrayectos(req, res) {
  const { userId: rawId } = req.user;
  console.log(
    "[obtenerMisTrayectos] Inicio — req.user keys:",
    Object.keys(req.user),
  );
  console.log("[obtenerMisTrayectos] rawId:", rawId, "| tipo:", typeof rawId);

  const id = String(rawId);
  if (!id || id === "undefined" || id === "null") {
    console.error("[obtenerMisTrayectos] ID de usuario inválido:", rawId);
    return res.status(400).send({
      status: "Error",
      message: "ID de usuario inválido en el token",
    });
  }

  console.log("[obtenerMisTrayectos] Obteniendo conexión a BD...");
  console.log("[obtenerMisTrayectos] Conexión BD obtenida");

  console.log("[obtenerMisTrayectos] Consultando trayectos del conductor:", id);
  const rows = await prisma.trayecto.findMany({
    where: { conductor: id },
  });
  console.log("[obtenerMisTrayectos] Trayectos encontrados:", rows.length);

  // Obtener mi nombre e imagen desde el microservicio de usuarios
  console.log(
    "[obtenerMisTrayectos] Obteniendo nombre e imagen del usuario:",
    id,
  );
  const myInfo = await UsersAPI.fetchUserPublicInfo(String(id));
  const myName = myInfo?.name || "Yo";
  const myImg = myInfo?.img_perfil;
  console.log(
    "[obtenerMisTrayectos] Nombre conductor:",
    myName,
    "| Imagen:",
    myImg || "sin imagen",
  );

  console.log(
    "[obtenerMisTrayectos] Obteniendo IDs de trayectos ya valorados por el usuario",
  );
  const ratedIds = await getRatedTrayectoIdsForUser(
    id,
    rows.map((t) => t.id),
  );
  console.log("[obtenerMisTrayectos] Trayectos valorados:", [...ratedIds]);

  const data = rows.map((t) => ({
    ...t,
    conductor: myName,
    conductor_id: t.conductor,
    img_perfil: myImg,
    valorado: ratedIds.has(String(t.id)),
  }));
  console.log(
    "[obtenerMisTrayectos] Respuesta enviada —",
    data.length,
    "trayectos",
  );
  return res.status(200).json(data);
}

async function obtenerProximosTrayectos(req, res) {
  const { userId: rawId } = req.user;
  const id = String(rawId);
  if (!id || id === "undefined" || id === "null") {
    return res.status(400).send({
      status: "Error",
      message: "ID de usuario inválido en el token",
    });
  }

  const now = new Date();
  const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const rows = await prisma.trayecto.findMany({
    where: {
      OR: [{ conductor: id }, { Reservas: { some: { user_id: id } } }],
      hora: { gte: now, lte: twoDaysLater },
      status: { notIn: ["finalizado", "cancelado"] },
    },
    orderBy: { hora: "asc" },
  });

  const conductorIds = [...new Set(rows.map((t) => String(t.conductor)))];
  const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
  const usersMap = new Map(usersList.map((u) => [u.id, u]));

  const ratedIds = await getRatedTrayectoIdsForUser(
    id,
    rows.map((t) => t.id),
  );

  const data = rows.map((t) => {
    const conductorInfo = usersMap.get(String(t.conductor));
    return {
      ...t,
      conductor: conductorInfo?.name || "Desconocido",
      conductor_id: t.conductor,
      img_perfil: conductorInfo?.img_perfil,
      valorado: ratedIds.has(String(t.id)),
    };
  });

  return res.status(200).json(data);
}

async function iniciarTrayecto(req, res) {
  const { id: trayectoId } = req.params;
  if (!trayectoId || trayectoId === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: {
      id: true,
      origen: true,
      destino: true,
      hora: true,
      conductor: true,
      status: true,
    },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(trayecto.conductor) !== String(userId)) {
    return res.status(401).send({
      status: "Error",
      message: "No eres el conductor de este trayecto",
    });
  }

  const status = String(trayecto.status ?? "").toLowerCase();
  if (status !== "programado") {
    return res.status(409).send({
      status: "Error",
      message: "El trayecto no está programado",
    });
  }

  const updated = await prisma.trayecto.updateMany({
    where: { id: trayectoId, status: "programado" },
    data: { status: "en curso" },
  });

  if (!updated.count) {
    return res.status(409).send({
      status: "Error",
      message: "No se pudo iniciar el trayecto (estado no válido)",
    });
  }

  try {
    await notifyTrayectoEnCurso(trayecto);
  } catch (e) {
    console.error("Error notificando trayecto en curso:", e);
  }

  try {
    const tipoEvento = await prisma.tipoEvento.findUnique({
      where: { nombre: "comienzo" },
    });
    if (tipoEvento) {
      await prisma.eventoTrayecto.create({
        data: {
          id: randomUUID(),
          id_trayecto: trayectoId,
          user_id: userId,
          id_tipo_evento: tipoEvento.id,
          lat: trayecto.origen_lat ?? 0,
          lng: trayecto.origen_lng ?? 0,
        },
      });
    }
  } catch (e) {
    console.error("Error creando evento de comienzo:", e);
  }

  return res.status(200).send({
    status: "Success",
    message: "Trayecto iniciado y notificado correctamente",
  });
}

async function finalizarTrayecto(req, res) {
  const { id } = req.params;
  const trayectoId = String(id);
  if (!trayectoId) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: {
      id: true,
      origen: true,
      destino: true,
      hora: true,
      conductor: true,
      status: true,
    },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(trayecto.conductor) !== String(userId)) {
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

  const updated = await prisma.trayecto.updateMany({
    where: { id: trayectoId, status: "en curso" },
    data: { status: "finalizado" },
  });

  if (!updated.count) {
    return res.status(409).send({
      status: "Error",
      message: "No se pudo finalizar el trayecto (estado no válido)",
    });
  }

  try {
    await notifyTrayectoFinalizado(trayecto);
  } catch (e) {
    console.error("Error notificando trayecto finalizado:", e);
  }

  try {
    const tipoEvento = await prisma.tipoEvento.findUnique({
      where: { nombre: "finalizacion" },
    });
    if (tipoEvento) {
      await prisma.eventoTrayecto.create({
        data: {
          id: randomUUID(),
          id_trayecto: trayectoId,
          user_id: userId,
          id_tipo_evento: tipoEvento.id,
          lat: trayecto.destino_lat ?? 0,
          lng: trayecto.destino_lng ?? 0,
        },
      });
    }
  } catch (e) {
    console.error("Error creando evento de finalizacion:", e);
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

  const data = { ...validation.data };

  // Check if there are any fields to update
  if (Object.keys(data).length === 0) {
    return res.status(400).send({
      status: "Error",
      message: "No se proporcionaron campos para actualizar.",
    });
  }

  // Build the Prisma update data object
  const updateData = {};

  // Combine 'fecha' and 'hora' if both are provided
  if (data.fecha && data.hora) {
    try {
      const fechaHoraSQL = convertirFechaHoraUTC(data.fecha, data.hora);
      updateData.hora = new Date(fechaHoraSQL);
      delete data.fecha;
      delete data.hora;
    } catch (error) {
      console.error("Error al procesar la fecha y hora:", error);
      return res.status(400).send({
        status: "Error",
        message: "Error al procesar la fecha y hora.",
      });
    }
  } else if (data.fecha || data.hora) {
    return res.status(400).send({
      status: "Error",
      message:
        "Debe proporcionar tanto la fecha como la hora para actualizar la hora del trayecto.",
    });
  }

  // Map remaining fields to Prisma update data
  for (const key in data) {
    updateData[key] = data[key];
  }

  try {
    const result = await prisma.trayecto.updateMany({
      where: { id },
      data: updateData,
    });
    if (result.count === 0) {
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

  let fechaHora = convertirFechaHoraUTC(fecha, hora);

  const original = await prisma.trayecto.findUnique({ where: { id } });
  if (!original) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const updateData = {};

  if (original.origen !== origen) {
    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    updateData.origen_lat = originCoords.lat;
    updateData.origen_lng = originCoords.lng;
  }
  if (original.destino !== destino) {
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    updateData.destino_lat = destinationCoords.lat;
    updateData.destino_lng = destinationCoords.lng;
  }

  if (original.plazas < plazas) {
    updateData.disponible = original.disponible + (plazas - original.plazas);
  } else {
    updateData.disponible = original.disponible - (original.plazas - plazas);
  }

  updateData.origen = origen;
  updateData.destino = destino;
  updateData.hora = new Date(fechaHora);
  updateData.plazas = plazas;
  updateData.conductor = conductor;
  updateData.precio = precio;
  updateData.routeIndex = routeIndex;

  await prisma.trayecto.update({
    where: { id },
    data: updateData,
  });

  return res
    .status(204)
    .send({ status: "Success", message: "Trayecto actualizado correctamente" });
}

async function eliminarTrayecto(req, res) {
  const { id } = req.params;
  try {
    await prisma.trayecto.delete({ where: { id } });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }
    throw error;
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

    const rows = await prisma.trayecto.findMany({
      where: {
        origen_lat: { gte: originMinLat, lte: originMaxLat },
        origen_lng: { gte: originMinLng, lte: originMaxLng },
        destino_lat: { gte: destMinLat, lte: destMaxLat },
        destino_lng: { gte: destMinLng, lte: destMaxLng },
        disponible: { gte: seats },
      },
      orderBy: { hora: "asc" },
    });

    // Filter by date (YYYY-MM-DD) in JavaScript since Prisma doesn't have DATE() function
    const targetDate = f;
    let dateFiltered = rows.filter((t) => {
      const trayectoDate = new Date(t.hora).toISOString().split("T")[0];
      return trayectoDate === targetDate;
    });
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
    if (dateFiltered.length > 0) {
      filtered = dateFiltered.filter((t) => {
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
        const conductorInfo = await UsersAPI.fetchUserPublicInfo(
          String(trayecto.conductor),
        );
        const img_perfil = conductorInfo?.img_perfil || null;
        const name = conductorInfo?.name || "Desconocido";
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
      userId,
      trayectosConImagen.map((t) => t.id),
    );
    trayectosConImagen = trayectosConImagen.map((t) => ({
      ...t,
      valorado: ratedIds.has(String(t.id)),
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
  const trayectos = await prisma.trayecto.findMany({
    select: { id: true, origen: true, destino: true },
  });
  for (const { id, origen, destino } of trayectos) {
    const originCoords = await GoogleMapsProvider.geocodeAddress(origen);
    const destinationCoords = await GoogleMapsProvider.geocodeAddress(destino);
    await prisma.trayecto.update({
      where: { id },
      data: {
        origen_lat: originCoords.lat,
        origen_lng: originCoords.lng,
        destino_lat: destinationCoords.lat,
        destino_lng: destinationCoords.lng,
      },
    });
  }

  return res.sendStatus(204);
}

async function updateLatLongById(req, res) {
  const { id } = req.params;
  const trayecto = await prisma.trayecto.findUnique({
    where: { id },
    select: { origen: true, destino: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }
  const originCoords = await GoogleMapsProvider.geocodeAddress(trayecto.origen);
  const destinationCoords = await GoogleMapsProvider.geocodeAddress(
    trayecto.destino,
  );
  await prisma.trayecto.update({
    where: { id },
    data: {
      origen_lat: originCoords.lat,
      origen_lng: originCoords.lng,
      destino_lat: destinationCoords.lat,
      destino_lng: destinationCoords.lng,
    },
  });

  return res.sendStatus(204);
}

async function obtenerTrayectoCompleto(req, res) {
  const { id } = req.params;

  const trayecto = await prisma.trayecto.findUnique({
    where: { id },
  });

  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  // --- Conductor info ---
  const conductorInfo = await UsersAPI.fetchUserPublicInfo(
    String(trayecto.conductor),
  );
  const conductorName = conductorInfo?.name || "Desconocido";
  const imgPerfil = conductorInfo?.img_perfil;

  // --- Driver preferences ---
  const driverPrefsRaw = await prisma.userPreference.findMany({
    where: {
      user_id: trayecto.conductor,
      PreferenceDefinition: { is_active: 1 },
    },
    include: {
      PreferenceDefinition: { select: { pref_key: true, value_type: true } },
    },
  });
  const driverPreferences = {};
  for (const p of driverPrefsRaw) {
    driverPreferences[p.PreferenceDefinition.pref_key] = parsePreferenceValue(
      p.PreferenceDefinition.value_type,
      p.value,
    );
  }

  // --- Passengers (reservas no canceladas) ---
  const reservas = await prisma.reserva.findMany({
    where: { id_trayecto: id, NOT: { status: "canceled" } },
  });

  const pasajeros = await Promise.all(
    reservas.map(async (r) => {
      const userInfo = await UsersAPI.fetchUserPublicInfo(String(r.user_id));
      const prefsRaw = await prisma.userPreference.findMany({
        where: {
          user_id: r.user_id,
          PreferenceDefinition: { is_active: 1 },
        },
        include: {
          PreferenceDefinition: {
            select: { pref_key: true, value_type: true },
          },
        },
      });
      const preferences = {};
      for (const p of prefsRaw) {
        preferences[p.PreferenceDefinition.pref_key] = parsePreferenceValue(
          p.PreferenceDefinition.value_type,
          p.value,
        );
      }
      return {
        id_reserva: r.id_reserva,
        user_id: r.user_id,
        status: r.status,
        trip_outcome: r.trip_outcome,
        nombre: userInfo?.name || "Desconocido",
        img_perfil: userInfo?.img_perfil || null,
        preferences,
      };
    }),
  );

  // --- Eventos del trayecto ---
  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: id },
    include: {
      TipoEvento: { select: { nombre: true } },
    },
    orderBy: { created_at: "asc" },
  });

  // --- Comentarios ---
  const comentarios = await prisma.comment.findMany({
    where: { id_trayecto: id },
    orderBy: { created_at: "desc" },
  });

  // --- ¿Usuario actual ha valorado? ---
  const userId = req.user?.id;
  const valorado = await hasUserRatedTrayecto(userId, trayecto.id);

  const fecha = new Date(trayecto.hora).toDateString();
  const fechaHora = new Date(trayecto.hora).toISOString();

  const response = {
    ...trayecto,
    conductor: conductorName,
    conductor_id: trayecto.conductor,
    img_perfil: imgPerfil,
    hora: fechaHora,
    fecha,
    valorado,
    driverPreferences,
    pasajeros,
    eventos: eventos.map((e) => ({
      id: e.id,
      tipo_evento: e.TipoEvento?.nombre,
      id_reserva: e.id_reserva,
      user_id: e.user_id,
      lat: e.lat,
      lng: e.lng,
      created_at: e.created_at,
    })),
    comentarios: comentarios.map((c) => ({
      id_comment: c.id_comment,
      user_id_commentator: c.user_id_commentator,
      user_id_trayect: c.user_id_trayect,
      opinion: c.opinion,
      rating: c.rating,
      created_at: c.created_at,
    })),
  };

  return res.status(200).json(response);
}

export const TrayectosController = {
  crearTrayecto,
  obtenerTrayectos: getTrayectos,
  eliminarTrayecto,
  obtenerTrayectoPorId,
  obtenerTrayectoCompleto,
  finalizarTrayecto,
  iniciarTrayecto,
  actualizarTrayecto,
  patchTrayecto,
  buscarTrayectos,
  obtenerTrayectosPorConductor,
  obtenerMisTrayectos,
  obtenerProximosTrayectos,
  updateLatLong,
  updateLatLongById,
};
