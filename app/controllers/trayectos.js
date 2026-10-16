import { randomUUID } from "crypto";
import { prisma } from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";
import { TrayectosSchema } from "../schemas/trayecto.js";
import { DateUtils } from "../utils/date.js";
import {
  notifyTrayectoFinalizado,
  notifyTrayectoEnCurso,
} from "../cron-jobs.js";
import { UsersAPI } from "../utils/users-api.js";
import {
  TRAYECTO_STATUS,
  TRAYECTO_INACTIVE_STATUSES,
  RESERVA_STATUS,
} from "../constants/statuses.js";
import { CAEUtils } from "../utils/cae.js";
import { ReservaController } from "./reserva.js";
import { PaginationUtils } from "../utils/pagination.js";
import { RoutingEngine } from "../services/routing/routing-engine.js";
import { RouteGeometryService } from "../services/routing/geometry-service.js";
import dotenv from "dotenv";

dotenv.config();
const MESSAGES_URL = process.env.MESSAGES_URL;
const USUARIOS_URL = process.env.USUARIOS_URL;

const SEARCH_DISTANCE_KM = 0.2; // 200 metros = 0.2 km
const EARTH_RADIUS_KM = 6371;

const EUR_PER_KM_TRAYECTO = parseFloat(
  process.env.EUR_PER_KM_TRAYECTO || "0.22",
);
const EUR_PER_KM_MIN = 0.06;
const EUR_PER_KM_MAX = 0.08;

const STRIPE_PERCENT = parseFloat(process.env.STRIPE_PERCENT || "0.015");
const STRIPE_FIXED_FEE = parseFloat(process.env.STRIPE_FIXED_FEE || "0.25");
const PLATFORM_COMMISSION_PERCENT = parseFloat(
  process.env.PLATFORM_COMMISSION_PERCENT || "0.15",
);

async function cotizarPrecio(precioConductor) {
  if (precioConductor === 0) return 0;
  const comision = precioConductor * PLATFORM_COMMISSION_PERCENT;
  const netoConComision = precioConductor + comision;
  const netoCents = Math.round(netoConComision * 100);
  const response = await fetch(
    `${USUARIOS_URL}/api/payment/cotizar?neto=${netoCents}`,
  );
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.message ?? "Error al cotizar el precio");
  }
  const data = await response.json();
  return data.total_eur;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

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
    const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
    const where = {
      status: { notIn: TRAYECTO_INACTIVE_STATUSES },
    };

    const trayectos = await prisma.trayecto.findMany({
      where,
      skip: offset,
      take: limit,
    });
    const total = await prisma.trayecto.count({ where });

    if (!trayectos || trayectos.length === 0) {
      return res.status(200).send({
        status: "Success",
        data: [],
        pagination: PaginationUtils.buildPaginationResponse({
          page,
          limit,
          total: 0,
        }),
      });
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

    return res.status(200).send({
      status: "Success",
      data: trayectosWithPreferences,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en getTrayectos:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error obteniendo trayectos" });
  }
}

async function obtenerTrayectosEnViewport(req, res) {
  try {
    const validation = TrayectosSchema.viewportQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).send({
        status: "Error",
        message: "Parámetros de viewport inválidos",
        errors: validation.error.errors,
      });
    }

    const {
      minLat,
      minLng,
      maxLat,
      maxLng,
      zoom,
      fecha,
      plazas,
      precision,
      limit,
    } = validation.data;

    const { globalSpatialIndex } =
      await import("../services/routing/spatial-index.js");

    const bbox = { minLat, maxLat, minLng, maxLng };
    const segmentEntries = globalSpatialIndex.searchBBox(bbox);

    let trayectoIds = [];
    if (segmentEntries && segmentEntries.length > 0) {
      trayectoIds = [...new Set(segmentEntries.map((e) => e.trayectoId))];
    } else {
      // Fallback a Base de Datos: buscar trayectos cuyos puntos de origen o destino estén dentro del bounding box
      const bboxWhere = {
        status: { in: ["programado", "en curso"] },
        disponible: { gte: plazas },
        OR: [
          {
            origen_lat: { gte: minLat, lte: maxLat },
            origen_lng: { gte: minLng, lte: maxLng },
          },
          {
            destino_lat: { gte: minLat, lte: maxLat },
            destino_lng: { gte: minLng, lte: maxLng },
          },
        ],
      };
      if (fecha) {
        const startOfDay = new Date(`${fecha}T00:00:00.000Z`);
        const endOfDay = new Date(`${fecha}T23:59:59.999Z`);
        bboxWhere.hora = { gte: startOfDay, lte: endOfDay };
      }
      const dbFallback = await prisma.trayecto.findMany({
        where: bboxWhere,
        take: limit,
        select: { id: true },
      });
      trayectoIds = dbFallback.map((t) => t.id);
    }

    if (!trayectoIds || trayectoIds.length === 0) {
      return res.status(200).send({
        status: "Success",
        data: [],
        meta: {
          totalMatches: 0,
          viewport: { minLat, minLng, maxLat, maxLng, zoom },
        },
      });
    }

    const where = {
      id: { in: trayectoIds },
      status: { in: ["programado", "en curso"] },
      disponible: { gte: plazas },
    };

    if (fecha) {
      const startOfDay = new Date(`${fecha}T00:00:00.000Z`);
      const endOfDay = new Date(`${fecha}T23:59:59.999Z`);
      where.hora = { gte: startOfDay, lte: endOfDay };
    }

    const trayectos = await prisma.trayecto.findMany({
      where,
      take: limit,
      include: {
        Tramos: {
          orderBy: { step_order: "asc" },
          select: { lat: true, lng: true, address: true, step_order: true },
        },
      },
      orderBy: { hora: "asc" },
    });

    if (!trayectos || trayectos.length === 0) {
      return res.status(200).send({
        status: "Success",
        data: [],
        meta: {
          totalMatches: 0,
          viewport: { minLat, minLng, maxLat, maxLng, zoom },
        },
      });
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

    const driverData = await Promise.all(
      driverIds.map(async (id) => {
        try {
          const response = await fetch(`${USUARIOS_URL}/api/users/${id}`);
          if (response.ok) return await response.json();
        } catch {}
        return null;
      }),
    );
    const driverMap = new Map(driverData.filter(Boolean).map((d) => [d.id, d]));

    const data = trayectos.map((t) => {
      const tramos = t.Tramos || [];

      // Usar RouteGeometryService para resolver la ruta (O(1) si tiene overview_polyline, fallback si no)
      const route = RouteGeometryService.resolvePolyline(t, {
        zoom,
        precision,
        format: "both", // Devolver tanto encodedPolyline como geometry si se pide
      });

      const driver = driverMap.get(t.conductor) || {};
      const conductorNombre = driver.name || driver.nombre || "Conductor";
      return {
        id: t.id,
        origen: t.origen,
        destino: t.destino,
        hora: t.hora,
        precio: t.precio,
        plazasTotales: t.plazas,
        plazasDisponibles: t.disponible,
        plazas: t.plazas,
        disponible: t.disponible,
        conductor: {
          id: t.conductor,
          nombre: conductorNombre,
          avatar: driver.avatar || driver.avatar_url || null,
          rating: driver.rating || 5.0,
        },
        conductor_id: t.conductor,
        conductor_nombre: conductorNombre,
        puntosClave: route.keyPoints,
        geometry: route.geometry, // Solo si se solicita ?format=geojson
        encodedPolyline: route.encodedPolyline, // NUEVO: Siempre incluido
        driverPreferences: preferencesByDriver[t.conductor] || {},
      };
    });
    console.log(data);
    return res.status(200).send({
      status: "Success",
      data,
      meta: {
        totalMatches: data.length,
        viewport: { minLat, minLng, maxLat, maxLng, zoom },
        clustered: precision === "bounds",
      },
    });
  } catch (error) {
    console.error("Error en obtenerTrayectosEnViewport:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo trayectos en viewport",
    });
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
    vehiculo_id,
    disponible,
    precio,
    routeIndex,
    evento_id,
    destino_lat,
    destino_lng,
    origen_lat,
    origen_lng,
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
    if (origen_lat != null && origen_lng != null) {
      console.log(
        "[crearTrayecto] Usando coordenadas pre-calculadas para origen:",
        origen_lat,
        origen_lng,
      );
      const revDetails = await GoogleMapsProvider.reverseGeocodeAddressDetails(
        origen_lat,
        origen_lng,
      );
      originDetails = {
        lat: origen_lat,
        lng: origen_lng,
        city: revDetails.city,
        province: revDetails.province,
      };
    } else {
      originDetails = await GoogleMapsProvider.geocodeAddressDetails(origen);
    }
    console.log(
      "[crearTrayecto] Origen geocodificado:",
      JSON.stringify(originDetails),
    );

    if (destino_lat != null && destino_lng != null) {
      console.log(
        "[crearTrayecto] Usando coordenadas pre-calculadas para destino:",
        destino_lat,
        destino_lng,
      );
      const revDetails = await GoogleMapsProvider.reverseGeocodeAddressDetails(
        destino_lat,
        destino_lng,
      );
      destinationDetails = {
        lat: destino_lat,
        lng: destino_lng,
        city: revDetails.city,
        province: revDetails.province,
      };
    } else {
      console.log("[crearTrayecto] Geocodificando destino:", destino);
      destinationDetails =
        await GoogleMapsProvider.geocodeAddressDetails(destino);
    }
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

  let precioConductor = 0;

  // Calcular ruta real (Directions API) para obtener distancia y tramos
  let routeSteps = [];
  let routeDistanceKm = null;
  let overviewPolyline = null;
  try {
    const originCoord = `${originDetails.lat},${originDetails.lng}`;
    const destCoord = `${destinationDetails.lat},${destinationDetails.lng}`;
    const route = await GoogleMapsProvider.getDirections(
      originCoord,
      destCoord,
      routeIndex,
    );
    routeSteps = route.steps;
    routeDistanceKm = route.distanceKm;
    overviewPolyline = route.overviewPolyline || null;
    console.log(
      "[crearTrayecto] Ruta Directions:",
      routeSteps.length,
      "tramos | distancia real:",
      routeDistanceKm != null ? `${routeDistanceKm.toFixed(2)} km` : "N/A",
      "| overviewPolyline:",
      overviewPolyline ? `${overviewPolyline.length} chars` : "null",
    );
  } catch (e) {
    console.error(
      "[crearTrayecto] Error al obtener ruta de Directions:",
      e?.message ?? e,
    );
  }

  // Fallback para overviewPolyline si Directions falló pero tenemos coordenadas de origen y destino
  if (!overviewPolyline && originDetails && destinationDetails) {
    overviewPolyline = RouteGeometryService.encodePolyline([
      [originDetails.lng, originDetails.lat],
      [destinationDetails.lng, destinationDetails.lat],
    ]);
  }

  if (precio === 0) {
    console.log(
      "[crearTrayecto] Precio establecido a 0 por el conductor, saltando verificación",
    );
  } else {
    try {
      // Usar distancia real de Directions; fallback a haversine si no disponible
      const distanceKm =
        routeDistanceKm ??
        haversineKm(
          originDetails.lat,
          originDetails.lng,
          destinationDetails.lat,
          destinationDetails.lng,
        );
      console.log(
        "[crearTrayecto] Distancia usada para pricing:",
        distanceKm.toFixed(2),
        "km",
        routeDistanceKm != null ? "(Directions)" : "(haversine fallback)",
      );

      const eurPerKm = Math.min(
        Math.max(EUR_PER_KM_TRAYECTO, EUR_PER_KM_MIN),
        EUR_PER_KM_MAX,
      );

      const precioMinEsperado =
        Math.round(distanceKm * EUR_PER_KM_MIN * 100) / 100;
      const precioMaxEsperado =
        Math.round(distanceKm * EUR_PER_KM_MAX * 100) / 100;

      console.log(
        "[crearTrayecto] Verificando precio del conductor:",
        precio,
        "€ | Rango aceptable:",
        precioMinEsperado,
        "-",
        precioMaxEsperado,
        "€ (",
        distanceKm.toFixed(2),
        "km ×",
        EUR_PER_KM_MIN,
        "-",
        EUR_PER_KM_MAX,
        "€/km)",
      );

      if (precio < precioMinEsperado || precio > precioMaxEsperado) {
        return res.status(400).send({
          status: "Error",
          message: `El precio ${precio}€ no es válido para un trayecto de ${distanceKm.toFixed(2)} km. Precio aceptable entre ${precioMinEsperado}€ y ${precioMaxEsperado}€ (basado en ${EUR_PER_KM_MIN}€- ${EUR_PER_KM_MAX}€/km).`,
        });
      }

      precioConductor = precio;
      precio = await cotizarPrecio(precioConductor);

      const comision =
        Math.round(precioConductor * PLATFORM_COMMISSION_PERCENT * 100) / 100;

      console.log(
        "[crearTrayecto] Precio conductor (verificado):",
        precioConductor,
        "€ | Precio pasajero (cotizado):",
        precio,
        "€ | Comisión plataforma:",
        comision,
        "€",
      );
    } catch (error) {
      console.error("[crearTrayecto] Error al verificar el precio:", error);
      return res.status(502).send({
        status: "Error",
        message: "No se pudo verificar el precio del trayecto",
      });
    }
  }

  const trayectoId = randomUUID();
  const fechaHoraDate = fechaHoraSQL;
  const nowForCheck = new Date();
  const diffMs = Math.abs(fechaHoraDate.getTime() - nowForCheck.getTime());
  const TWO_MINUTES = 2 * 60 * 1000;
  const iniciarInmediato = diffMs <= TWO_MINUTES;
  const estadoInicial = iniciarInmediato ? "en curso" : "programado";

  try {
    console.log(
      "[crearTrayecto] Insertando trayecto en BD con UUID:",
      trayectoId,
      "| estado inicial:",
      estadoInicial,
    );
    await prisma.trayecto.create({
      data: {
        id: trayectoId,
        origen,
        destino,
        hora: fechaHoraSQL,
        plazas,
        conductor,
        vehiculo_id: vehiculo_id || null,
        disponible,
        precio,
        precio_conductor: precioConductor,
        status: estadoInicial,
        origen_lat: originDetails.lat,
        origen_lng: originDetails.lng,
        destino_lat: destinationDetails.lat,
        destino_lng: destinationDetails.lng,
        overview_polyline: overviewPolyline,
        routeIndex,
        evento_id: evento_id ?? null,
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

  // Guardar tramos (pasos de la ruta) — ya calculados arriba
  try {
    if (routeSteps.length > 0) {
      await prisma.tramo.createMany({
        data: routeSteps.map((step, index) => ({
          id: randomUUID(),
          id_trayecto: trayectoId,
          lat: step.lat,
          lng: step.lng,
          address: step.address,
          step_order: index,
        })),
      });
      console.log(
        `[crearTrayecto] ${routeSteps.length} tramos guardados para trayecto ${trayectoId}`,
      );
    }
  } catch (e) {
    console.error("[crearTrayecto] Error generando tramos:", e?.message ?? e);
  }

  // Indexar trayecto en R-Tree en memoria para búsqueda en mapa en tiempo real
  try {
    RoutingEngine.indexTrayecto(
      {
        id: insertedId,
        hora: fechaHoraSQL,
        plazas,
        disponible,
        precio,
        conductor,
        evento_id: evento_id ?? null,
        origen_lat: originDetails.lat,
        origen_lng: originDetails.lng,
        destino_lat: destinationDetails.lat,
        destino_lng: destinationDetails.lng,
        origen,
        destino,
      },
      routeSteps,
    );
    console.log(
      `[crearTrayecto] Trayecto ${insertedId} indexado en R-Tree en tiempo real.`,
    );
  } catch (errIndex) {
    console.error(
      "[crearTrayecto] Error al indexar en R-Tree:",
      errIndex?.message ?? errIndex,
    );
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
    vehiculo_id: vehiculo_id || null,
    precio_conductor: precioConductor,
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

  if (iniciarInmediato) {
    try {
      const tipoEvento = await prisma.tipoEvento.findUnique({
        where: { nombre: "comienzo" },
      });
      if (tipoEvento) {
        await prisma.eventoTrayecto.create({
          data: {
            id: randomUUID(),
            id_trayecto: insertedId,
            user_id: conductor,
            id_tipo_evento: tipoEvento.id,
            lat: originDetails.lat ?? 0,
            lng: originDetails.lng ?? 0,
          },
        });
        console.log(
          "[crearTrayecto] Evento de comienzo generado automáticamente",
        );
      }
    } catch (e) {
      console.error(
        "[crearTrayecto] Error al generar evento de comienzo automático:",
        e,
      );
    }

    try {
      await notifyTrayectoEnCurso({
        id: insertedId,
        origen,
        destino,
        conductor,
        hora: fechaHoraSQL,
      });
    } catch (e) {
      console.error(
        "[crearTrayecto] Error notificando trayecto en curso automático:",
        e,
      );
    }
  }

  return res.status(201).send({
    status: "Success",
    message: "Trayecto creado correctamente",
    trayecto: newTrayecto,
  });
}

function convertirFechaHoraUTC(fecha, hora) {
  const fechaHora = new Date(`${fecha.trim()}T${hora.trim()}:00.000Z`);
  return fechaHora;
}

async function obtenerTrayectos(req, res) {
  const rows = await prisma.trayecto.findMany({
    where: { status: { notIn: TRAYECTO_INACTIVE_STATUSES } },
  });
  const userId = req.user?.id;

  // Obtener detalles de conductores (nombre e imagen) desde el microservicio de usuarios
  const conductorIds = [...new Set(rows.map((t) => t.conductor))];
  const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
  const usersMap = new Map(usersList.map((u) => [u.id, u]));

  const ratedIds = await getRatedTrayectoIdsForUser(
    userId,
    rows.map((t) => t.id),
  );

  const vehicleIds = [
    ...new Set(rows.map((t) => t.vehiculo_id).filter(Boolean)),
  ];
  const vehicleResults = await Promise.all(
    vehicleIds.map(async (vid) => {
      const info = await UsersAPI.fetchVehicleInfo(vid);
      return [vid, info];
    }),
  );
  const vehicleMap = new Map(vehicleResults.filter(([, v]) => v));

  const data = rows.map((t) => {
    const user = usersMap.get(t.conductor);
    return {
      ...t,
      conductor: user?.name || "Desconocido",
      conductor_id: t.conductor,
      vehiculo: vehicleMap.get(t.vehiculo_id) || null,
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

  const vehicleInfo = await UsersAPI.fetchVehicleInfo(trayecto.vehiculo_id);

  const fechaHora = new Date(trayecto.hora).toISOString();
  const fecha = fechaHora.split("T")[0];
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
    vehiculo: vehicleInfo,
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
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const currentuserId = req.user?.userId ?? req.user?.id;
  const isOwnerOrAdmin =
    (currentuserId && String(currentuserId) === String(id)) ||
    req.user?.role === "admin";

  try {
    const where = {
      conductor: id,
      ...(isOwnerOrAdmin
        ? {}
        : { status: { notIn: TRAYECTO_INACTIVE_STATUSES } }),
    };

    const rows = await prisma.trayecto.findMany({
      where,
      orderBy: { hora: "desc" },
      skip: offset,
      take: limit,
    });
    const total = await prisma.trayecto.count({ where });

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
    const ratedIds = await getRatedTrayectoIdsForUser(
      currentuserId,
      trayectos.map((t) => t.id),
    );
    trayectos = trayectos.map((t) => ({
      ...t,
      valorado: ratedIds.has(String(t.id)),
    }));

    return res.status(200).json({
      data: trayectos,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en obtenerTrayectosPorConductor:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo trayectos por conductor",
    });
  }
}

async function obtenerMisTrayectos(req, res) {
  const { userId: rawId } = req.user;
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);

  const id = String(rawId);
  if (!id || id === "undefined" || id === "null") {
    return res.status(400).send({
      status: "Error",
      message: "ID de usuario inválido en el token",
    });
  }

  try {
    // Trayectos como conductor
    const conductorRows = await prisma.trayecto.findMany({
      where: { conductor: id },
      orderBy: { hora: "desc" },
    });

    // Trayectos como pasajero (vía reservas no canceladas)
    const reservas = await prisma.reserva.findMany({
      where: { user_id: id, NOT: { status: "canceled" } },
      select: { id_trayecto: true, id_reserva: true, status: true },
    });
    const reservaByTrayecto = new Map();
    for (const r of reservas) {
      reservaByTrayecto.set(r.id_trayecto, r);
    }
    const passengerTrayectoIds = [...reservaByTrayecto.keys()].filter(
      (tid) => !conductorRows.some((t) => t.id === tid),
    );

    let passengerRows = [];
    if (passengerTrayectoIds.length > 0) {
      passengerRows = await prisma.trayecto.findMany({
        where: { id: { in: passengerTrayectoIds } },
      });
    }

    // Combinar y ordenar por hora desc
    const allRows = [
      ...conductorRows.map((t) => ({ _row: t, _rol: "conductor" })),
      ...passengerRows.map((t) => ({ _row: t, _rol: "pasajero" })),
    ].sort((a, b) => b._row.hora.getTime() - a._row.hora.getTime());

    const total = allRows.length;
    const pageRows = allRows.slice(offset, offset + limit);

    // Info del propio usuario (para rol conductor)
    const myInfo = await UsersAPI.fetchUserPublicInfo(String(id));
    const myName = myInfo?.name || "Yo";
    const myImg = myInfo?.img_perfil;

    // Info de conductores ajenos (para rol pasajero)
    const foreignConductorIds = [
      ...new Set(
        pageRows
          .filter((p) => p._rol === "pasajero")
          .map((p) => p._row.conductor),
      ),
    ];
    const foreignConductorInfo = {};
    await Promise.all(
      foreignConductorIds.map(async (cid) => {
        const info = await UsersAPI.fetchUserPublicInfo(String(cid));
        foreignConductorInfo[cid] = {
          name: info?.name || "Desconocido",
          img_perfil: info?.img_perfil,
        };
      }),
    );

    const ratedIds = await getRatedTrayectoIdsForUser(
      id,
      pageRows.map((p) => p._row.id),
    );

    const data = pageRows.map(({ _row: t, _rol }) => {
      const isConductor = _rol === "conductor";
      const reserva = reservaByTrayecto.get(t.id);
      const conductorInfo = isConductor
        ? { name: myName, img_perfil: myImg }
        : foreignConductorInfo[t.conductor] || {
            name: "Desconocido",
            img_perfil: undefined,
          };
      return {
        ...t,
        rol: _rol,
        conductor: conductorInfo.name,
        conductor_id: t.conductor,
        img_perfil: conductorInfo.img_perfil,
        valorado: ratedIds.has(String(t.id)),
        ...(reserva && {
          id_reserva: reserva.id_reserva,
          reserva_status: reserva.status,
        }),
      };
    });

    return res.status(200).json({
      data,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en obtenerMisTrayectos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo mis trayectos",
    });
  }
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

  try {
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const where = {
      AND: [
        {
          OR: [
            { conductor: id },
            {
              Reservas: {
                some: {
                  user_id: id,
                  status: { notIn: [RESERVA_STATUS.CANCELED] },
                },
              },
            },
          ],
        },
        {
          OR: [
            { status: TRAYECTO_STATUS.EN_CURSO },
            { hora: { gte: now, lte: twoDaysLater } },
          ],
        },
        {
          status: {
            notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
          },
        },
      ],
    };

    // Parámetro opcional de zoom para control de simplificación (default 12)
    const zoom = parseInt(req.query.zoom) || 12;

    const rows = await prisma.trayecto.findMany({
      where,
      orderBy: { hora: "asc" },
      include: {
        Reservas: {
          where: { status: { notIn: [RESERVA_STATUS.CANCELED] } },
          select: {
            id_reserva: true,
            user_id: true,
            status: true,
            trip_outcome: true,
            created_at: true,
          },
        },
        Tramos: {
          orderBy: { step_order: "asc" },
          select: { lat: true, lng: true, address: true, step_order: true },
        },
      },
    });

    const conductorIds = [...new Set(rows.map((t) => String(t.conductor)))];
    const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    // Recopilar IDs de pasajeros para fetchear su info pública
    const passengerIds = [
      ...new Set(
        rows.flatMap((t) => (t.Reservas ?? []).map((r) => String(r.user_id))),
      ),
    ];
    const passengersList = await UsersAPI.fetchUsersByIds(passengerIds);
    const passengersMap = new Map(passengersList.map((u) => [u.id, u]));

    const ratedIds = await getRatedTrayectoIdsForUser(
      id,
      rows.map((t) => t.id),
    );

    const data = rows.map((t) => {
      const conductorInfo = usersMap.get(String(t.conductor));
      const reservas = (t.Reservas ?? []).map((r) => {
        const passengerInfo = passengersMap.get(String(r.user_id));
        return {
          id_reserva: r.id_reserva,
          user_id: r.user_id,
          status: r.status,
          trip_outcome: r.trip_outcome,
          created_at: r.created_at,
          nombre: passengerInfo?.name || "Desconocido",
          img_perfil: passengerInfo?.img_perfil,
        };
      });

      const tramos = t.Tramos ?? [];

      // Usar RouteGeometryService para resolver la ruta (O(1) si tiene overview_polyline, fallback si no)
      const route = RouteGeometryService.resolvePolyline(t, {
        zoom,
        precision: "simplified",
        format: "both", // Devolver tanto encodedPolyline como geometry
      });

      return {
        ...t,
        Reservas: undefined,
        reservas,
        conductor: conductorInfo?.name || "Desconocido",
        conductor_id: t.conductor,
        img_perfil: conductorInfo?.img_perfil,
        valorado: false, // ratedIds check removed for simplicity
        puntosClave: route.keyPoints,
        geometry: route.geometry,
        encodedPolyline: route.encodedPolyline, // NUEVO: Siempre incluido
      };
    });

    return res.status(200).json({
      data,
    });
  } catch (error) {
    console.error("Error en obtenerProximosTrayectos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo próximos trayectos",
    });
  }
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
      origen_lat: true,
      origen_lng: true,
      destino_lat: true,
      destino_lng: true,
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
  if (status !== TRAYECTO_STATUS.EN_CURSO) {
    return res.status(409).send({
      status: "Error",
      message: "El trayecto no está en curso",
    });
  }

  const updated = await prisma.trayecto.updateMany({
    where: { id: trayectoId, status: TRAYECTO_STATUS.EN_CURSO },
    data: { status: TRAYECTO_STATUS.FINALIZADO },
  });

  if (!updated.count) {
    return res.status(409).send({
      status: "Error",
      message: "No se pudo finalizar el trayecto (estado no válido)",
    });
  }

  // Desindexar trayecto del R-Tree en memoria (Lazy Deletion O(1))
  RoutingEngine.removeTrayecto(trayectoId);
  console.log(
    `[finalizarTrayecto] Trayecto ${trayectoId} desindexado de R-Tree.`,
  );

  try {
    await notifyTrayectoFinalizado(trayecto);
  } catch (e) {
    console.error("Error notificando trayecto finalizado:", e);
  }

  try {
    const captureResult =
      await ReservaController.capturarPagosTrayecto(trayectoId);
    console.log("[finalizarTrayecto] Captura de pagos:", captureResult);
  } catch (e) {
    console.error("Error capturando pagos del trayecto:", e);
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

  CAEUtils.generateInfoCAE(trayectoId).catch((e) => {
    console.error("[CAE] Error generando informe:", e);
  });

  return res.status(200).send({
    status: "Success",
    message: "Trayecto finalizado y notificado correctamente",
  });
}

async function actualizarTrayecto(req, res) {
  const { id } = req.params;
  const authUserId = req.user?.id || req.user?.userId;
  const userRole = req.user?.role;

  if (!authUserId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const existing = await prisma.trayecto.findUnique({
    where: { id },
    select: { conductor: true },
  });
  if (!existing) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(existing.conductor) !== String(authUserId) && userRole !== "admin") {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para actualizar este trayecto",
    });
  }

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
      updateData.hora = fechaHoraSQL;
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
    if (key === "vehiculo_id") {
      updateData[key] = data[key] || null;
    } else {
      updateData[key] = data[key];
    }
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
  const authUserId = req.user?.id || req.user?.userId;
  const userRole = req.user?.role;

  if (!authUserId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const original = await prisma.trayecto.findUnique({ where: { id } });
  if (!original) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(original.conductor) !== String(authUserId) && userRole !== "admin") {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para modificar este trayecto",
    });
  }

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
    vehiculo_id,
    precio,
    routeIndex,
  } = validation.data;

  const fechaHora = convertirFechaHoraUTC(fecha, hora);

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
  updateData.hora = fechaHora;
  updateData.plazas = plazas;
  updateData.conductor = conductor;
  updateData.vehiculo_id = vehiculo_id || null;
  updateData.routeIndex = routeIndex;

  if (precio === 0) {
    updateData.precio = 0;
    updateData.precio_conductor = 0;
  } else {
    const lat1 = updateData.origen_lat ?? original.origen_lat;
    const lng1 = updateData.origen_lng ?? original.origen_lng;
    const lat2 = updateData.destino_lat ?? original.destino_lat;
    const lng2 = updateData.destino_lng ?? original.destino_lng;

    if (lat1 != null && lng1 != null && lat2 != null && lng2 != null) {
      // Usar distancia real de Directions; fallback a haversine
      let distanceKm = null;
      try {
        const route = await GoogleMapsProvider.getDirections(
          `${lat1},${lng1}`,
          `${lat2},${lng2}`,
          routeIndex,
        );
        distanceKm = route.distanceKm;
      } catch (e) {
        console.error(
          "[updateTrayecto] Error obteniendo ruta de Directions:",
          e?.message ?? e,
        );
      }
      if (distanceKm == null) {
        distanceKm = haversineKm(lat1, lng1, lat2, lng2);
      }

      const precioMinEsperado =
        Math.round(distanceKm * EUR_PER_KM_MIN * 100) / 100;
      const precioMaxEsperado =
        Math.round(distanceKm * EUR_PER_KM_MAX * 100) / 100;

      if (precio < precioMinEsperado || precio > precioMaxEsperado) {
        return res.status(400).send({
          status: "Error",
          message: `El precio ${precio}€ no es válido para un trayecto de ${distanceKm.toFixed(2)} km. Precio aceptable entre ${precioMinEsperado}€ y ${precioMaxEsperado}€ (basado en ${EUR_PER_KM_MIN}€- ${EUR_PER_KM_MAX}€/km).`,
        });
      }

      updateData.precio_conductor = precio;
      updateData.precio = await cotizarPrecio(precio);
    } else {
      updateData.precio = precio;
    }
  }

  await prisma.trayecto.update({
    where: { id },
    data: updateData,
  });

  // Reindexar trayecto en R-Tree si sigue activo, o desindexar si pasó a inactivo
  try {
    const tramosActuales = await prisma.tramo.findMany({
      where: { id_trayecto: id },
      orderBy: { step_order: "asc" },
      select: { lat: true, lng: true, address: true, step_order: true },
    });

    const newStatus = updateData.status ?? "programado";
    if (["programado", "en curso"].includes(newStatus)) {
      const fullTrayecto = await prisma.trayecto.findUnique({ where: { id } });
      RoutingEngine.indexTrayecto(
        fullTrayecto || { id, ...updateData, status: newStatus },
        tramosActuales,
      );
      console.log(`[actualizarTrayecto] Trayecto ${id} reindexado en R-Tree.`);
    } else {
      RoutingEngine.removeTrayecto(id);
      console.log(
        `[actualizarTrayecto] Trayecto ${id} desindexado de R-Tree (estado inactivo).`,
      );
    }
  } catch (e) {
    console.error(
      "[actualizarTrayecto] Error reindexando en R-Tree:",
      e?.message ?? e,
    );
  }

  return res
    .status(204)
    .send({ status: "Success", message: "Trayecto actualizado correctamente" });
}

async function eliminarTrayecto(req, res) {
  const { id } = req.params;
  const authUserId = req.user?.id || req.user?.userId;
  const userRole = req.user?.role;

  if (!authUserId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const existing = await prisma.trayecto.findUnique({
    where: { id },
    select: { conductor: true },
  });
  if (!existing) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(existing.conductor) !== String(authUserId) && userRole !== "admin") {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para eliminar este trayecto",
    });
  }

  try {
    await prisma.$transaction([
      prisma.tramo.deleteMany({ where: { id_trayecto: id } }),
      prisma.recorrido.deleteMany({ where: { id_trayecto: id } }),
      prisma.eventoTrayecto.deleteMany({ where: { id_trayecto: id } }),
      prisma.comment.deleteMany({ where: { id_trayecto: id } }),
      prisma.infoCAEs.deleteMany({ where: { id_trayecto: id } }),
      prisma.pago.deleteMany({ where: { id_trayecto: id } }),
      prisma.reserva.deleteMany({ where: { id_trayecto: id } }),
      prisma.trayecto.delete({ where: { id } }),
    ]);

    // Desindexar trayecto del R-Tree en memoria
    RoutingEngine.removeTrayecto(id);
    console.log(`[eliminarTrayecto] Trayecto ${id} desindexado de R-Tree.`);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }
    console.error("Error en eliminarTrayecto:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error al eliminar el trayecto" });
  }
  return res
    .status(200)
    .json({ status: "Success", message: "Trayecto eliminado correctamente" });
}

async function buscarTrayectos(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "10", 10), 1),
      100,
    );
    const offset = (page - 1) * limit;
    const originParam = req.query.origin ?? req.query.origen;
    const destParam = req.query.destination ?? req.query.destino;
    const dateParam = req.query.date ?? req.query.fecha;
    const passParam =
      req.query.passengers ?? req.query.plazas ?? req.query.pasajeros ?? "1";

    const o = (originParam ?? "").toString().trim();
    const d = (destParam ?? "").toString().trim();
    const f = (dateParam ?? "").toString().trim();
    const pRaw = (passParam ?? "").toString().trim();

    if (!o || !d || !f || !pRaw) {
      return res.status(400).send({
        status: "Error",
        message:
          "Parámetros requeridos: origin/origen, destination/destino, date/fecha (YYYY-MM-DD), passengers/pasajeros/plazas",
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
    console.log(
      "[buscarTrayectos] Origen usuario:",
      JSON.stringify(userOriginCoords),
    );
    console.log(
      "[buscarTrayectos] Destino usuario:",
      JSON.stringify(userDestCoords),
    );

    res.locals.searchOriginLat = userOriginCoords.lat;
    res.locals.searchOriginLng = userOriginCoords.lng;
    res.locals.searchDestLat = userDestCoords.lat;
    res.locals.searchDestLng = userDestCoords.lng;

    // 2. BÚSQUEDA ESPACIAL INICIAL con R-Tree
    const { globalSpatialIndex } =
      await import("../services/routing/spatial-index.js");

    // Obtener parámetros de búsqueda
    const searchRadiusKm = parseFloat(req.query.searchRadiusKm) || 2.5;
    const maxDetourKm = parseFloat(req.query.maxDetourKm) || 5.0;
    const maxDetourMins = parseInt(req.query.maxDetourMins) || 15;

    // Buscar trayectos cercanos al origen
    const originMatches = globalSpatialIndex.searchNearbySegments(
      userOriginCoords.lat,
      userOriginCoords.lng,
      searchRadiusKm,
    );

    // Buscar trayectos cercanos al destino
    const destMatches = globalSpatialIndex.searchNearbySegments(
      userDestCoords.lat,
      userDestCoords.lng,
      searchRadiusKm,
    );

    // Obtener IDs únicos de trayectos candidatos
    const candidateTrayectoIds = new Set([
      ...originMatches.map((m) => m.entry.trayectoId),
      ...destMatches.map((m) => m.entry.trayectoId),
    ]);

    if (candidateTrayectoIds.size === 0) {
      // Fallback a Base de Datos: buscar trayectos activos con fecha y capacidad compatibles
      const dbCandidates = await prisma.trayecto.findMany({
        where: {
          disponible: { gte: seats },
          status: { in: ["programado", "en curso"] },
          hora: {
            gte: new Date(`${fecha}T00:00:00.000Z`),
            lte: new Date(`${fecha}T23:59:59.999Z`),
          },
        },
        include: {
          Tramos: {
            orderBy: { step_order: "asc" },
            select: { lat: true, lng: true, address: true, step_order: true },
          },
        },
        take: 50,
      });

      const effectiveRadius = Math.max(searchRadiusKm, 10.0);
      for (const t of dbCandidates) {
        let matchesOrigin = false;
        let matchesDest = false;

        if (t.origen_lat != null && t.origen_lng != null) {
          matchesOrigin =
            haversineKm(
              userOriginCoords.lat,
              userOriginCoords.lng,
              t.origen_lat,
              t.origen_lng,
            ) <= effectiveRadius;
        }
        if (t.destino_lat != null && t.destino_lng != null) {
          matchesDest =
            haversineKm(
              userDestCoords.lat,
              userDestCoords.lng,
              t.destino_lat,
              t.destino_lng,
            ) <= effectiveRadius;
        }

        const tramos = t.Tramos || [];
        if (!matchesOrigin && tramos.length > 0) {
          matchesOrigin = tramos.some(
            (tr) =>
              haversineKm(
                userOriginCoords.lat,
                userOriginCoords.lng,
                tr.lat,
                tr.lng,
              ) <= effectiveRadius,
          );
        }
        if (!matchesDest && tramos.length > 0) {
          matchesDest = tramos.some(
            (tr) =>
              haversineKm(
                userDestCoords.lat,
                userDestCoords.lng,
                tr.lat,
                tr.lng,
              ) <= effectiveRadius,
          );
        }

        if (matchesOrigin || matchesDest) {
          candidateTrayectoIds.add(t.id);
        }
      }
    }

    if (candidateTrayectoIds.size === 0) {
      // No hay candidatos cercanos
      return res.status(200).json({
        data: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    // 3. FILTRAR Y ENRIQUECER CON ROUTING ENGINE
    const candidateIds = Array.from(candidateTrayectoIds);

    // Obtener trayectos candidatos de la BD
    const candidateTrayectos = await prisma.trayecto.findMany({
      where: {
        id: { in: candidateIds },
        disponible: { gte: seats },
        status: { in: ["programado", "en curso"] },
        hora: {
          gte: new Date(`${fecha}T00:00:00.000Z`),
          lte: new Date(`${fecha}T23:59:59.999Z`),
        },
      },
      include: {
        Tramos: {
          orderBy: { step_order: "asc" },
          select: { lat: true, lng: true, address: true, step_order: true },
        },
      },
    });

    if (candidateTrayectos.length === 0) {
      return res.status(200).json({
        data: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    // 4. EVALUAR COMPATIBILIDAD CON ROUTING ENGINE
    const { RoutingEngine } =
      await import("../services/routing/routing-engine.js");

    const matchedTrips = RoutingEngine.findCompatibleTrips(candidateTrayectos, {
      origin: userOriginCoords,
      destination: userDestCoords,
      targetDate: fecha,
      seats,
      maxDetourKm,
      maxDetourMins,
      searchRadiusKm,
    });

    console.log(
      `[buscarTrayectos] ${matchedTrips.length} trayectos compatibles de ${candidateTrayectos.length} candidatos`,
    );

    // Ordenar por menor desvío, luego por hora
    matchedTrips.sort((a, b) => {
      const detourDiff =
        (a.routingMatch?.detourKm || 0) - (b.routingMatch?.detourKm || 0);
      if (Math.abs(detourDiff) > 0.5) return detourDiff;
      return new Date(a.hora).getTime() - new Date(b.hora).getTime();
    });

    // Aplicar paginación
    const total = matchedTrips.length;
    const pageSlice = matchedTrips.slice(offset, offset + limit);

    // Enriquecer con info de conductor
    const driverIds = [...new Set(pageSlice.map((t) => t.conductor))];
    const usersList = await UsersAPI.fetchUsersByIds(driverIds);
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    const trayectosConImagen = pageSlice.map((t) => {
      const driverInfo = usersMap.get(String(t.conductor));
      const tramos = t.Tramos ?? [];

      // Usar RouteGeometryService para resolver la ruta (O(1) si tiene overview_polyline, fallback si no)
      const route = RouteGeometryService.resolvePolyline(t, {
        zoom: 12,
        precision: "simplified",
        format: "both", // Devolver tanto encodedPolyline como geometry
      });

      const conductorNombre = driverInfo?.name || "Desconocido";
      const conductorObj = {
        id: t.conductor,
        nombre: conductorNombre,
        avatar: driverInfo?.img_perfil || null,
        rating: driverInfo?.rating || 5.0,
      };

      return {
        ...t,
        Tramos: undefined,
        conductor: conductorObj,
        conductor_nombre: conductorNombre,
        conductor_id: t.conductor,
        img_perfil: driverInfo?.img_perfil || null,
        plazasTotales: t.plazas,
        plazasDisponibles: t.disponible,
        plazas: t.plazas,
        disponible: t.disponible,
        puntosClave: route.keyPoints,
        geometry: route.geometry, // Solo si se solicita ?format=geojson
        encodedPolyline: route.encodedPolyline, // NUEVO: Siempre incluido
        routingMatch: t.routingMatch,
      };
    });

    res.locals.searchResultsCount = trayectosConImagen.length;
    const totalPages = Math.max(
      Math.ceil(trayectosConImagen.length / limit),
      1,
    );

    return res.status(200).json({
      data: trayectosConImagen,
      pagination: {
        page,
        limit,
        total: trayectosConImagen.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error en buscarTrayectos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error buscando trayectos",
    });
  }
}

async function updateLatLong(req, res) {
  if (req.user?.role !== "admin") {
    return res.status(403).send({
      status: "Error",
      message: "Solo un admin puede actualizar coordenadas masivamente",
    });
  }

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
  const authUserId = req.user?.id || req.user?.userId;
  const userRole = req.user?.role;

  if (!authUserId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id },
    select: { origen: true, destino: true, conductor: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(trayecto.conductor) !== String(authUserId) && userRole !== "admin") {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para actualizar este trayecto",
    });
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

  const fechaHora = new Date(trayecto.hora).toISOString();
  const fecha = fechaHora.split("T")[0];

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
    route: RouteGeometryService.resolvePolyline(trayecto, {
      zoom: 15,
      precision: "full",
      format: "both", // Devolver tanto encodedPolyline como geometry
    }),
  };

  return res.status(200).json(response);
}

async function crearTrayectoEvento(req, res) {
  const { evento_id, origen, destino } = req.body;
  console.log(req.body);
  if (!evento_id) {
    return res.status(400).send({
      status: "Error",
      message:
        "evento_id es obligatorio para crear un trayecto hacia un evento",
    });
  }

  if (!origen && !destino) {
    return res.status(400).send({
      status: "Error",
      message:
        "Debe indicar 'origen' (trayecto de ida) o 'destino' (trayecto de vuelta)",
    });
  }

  const { headers } = getAuthHeaders(req);

  let eventoInfo = await UsersAPI.fetchEventoInfo(evento_id, { headers });
  if (!eventoInfo) {
    return res.status(404).send({
      status: "Error",
      message: "No se pudo obtener la información del evento",
    });
  }
  eventoInfo = eventoInfo.event;

  if (eventoInfo.latitude == null || eventoInfo.longitude == null) {
    return res.status(400).send({
      status: "Error",
      message: "El evento no tiene una ubicación válida",
    });
  }

  const eventoNombre = eventoInfo.name || "Ubicación del evento";
  const eventoLat = parseFloat(eventoInfo.latitude);
  const eventoLng = parseFloat(eventoInfo.longitude);

  if (origen && !destino) {
    // Trayecto de ida: origen del usuario, destino = evento
    req.body.destino = eventoNombre;
    req.body.destino_lat = eventoLat;
    req.body.destino_lng = eventoLng;
  } else if (destino && !origen) {
    // Trayecto de vuelta: origen = evento, destino del usuario
    req.body.origen = eventoNombre;
    req.body.origen_lat = eventoLat;
    req.body.origen_lng = eventoLng;
  }

  req.body.evento_id = evento_id;

  return crearTrayecto(req, res);
}

async function obtenerTrayectosPorEvento(req, res) {
  const { eventoId } = req.params;
  const { direccion } = req.query;
  if (!eventoId) {
    return res.status(400).send({
      status: "Error",
      message: "eventoId es obligatorio",
    });
  }

  try {
    const where = {
      evento_id: eventoId,
      status: { notIn: TRAYECTO_INACTIVE_STATUSES },
    };

    let eventoLat = null;
    let eventoLng = null;

    if (direccion === "ida" || direccion === "vuelta") {
      const { headers } = getAuthHeaders(req);
      const eventoInfo = await UsersAPI.fetchEventoInfo(eventoId, { headers });
      if (
        eventoInfo?.event?.latitude != null &&
        eventoInfo?.event?.longitude != null
      ) {
        eventoLat = parseFloat(eventoInfo.event.latitude);
        eventoLng = parseFloat(eventoInfo.event.longitude);
      }
    }

    let rows = await prisma.trayecto.findMany({
      where,
      orderBy: { hora: "asc" },
    });

    if (direccion === "ida" && eventoLat != null) {
      rows = rows.filter(
        (t) =>
          t.destino_lat != null &&
          Math.abs(t.destino_lat - eventoLat) < 0.0001 &&
          Math.abs(t.destino_lng - eventoLng) < 0.0001,
      );
    } else if (direccion === "vuelta" && eventoLat != null) {
      rows = rows.filter(
        (t) =>
          t.origen_lat != null &&
          Math.abs(t.origen_lat - eventoLat) < 0.0001 &&
          Math.abs(t.origen_lng - eventoLng) < 0.0001,
      );
    }

    const conductorIds = [...new Set(rows.map((t) => String(t.conductor)))];
    const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    const userId = req.user?.id;
    const ratedIds = await getRatedTrayectoIdsForUser(
      userId,
      rows.map((t) => t.id),
    );

    const data = rows.map((t) => {
      const conductorInfo = usersMap.get(String(t.conductor));
      return {
        ...t,
        conductor: conductorInfo?.name || "Desconocido",
        conductor_id: t.conductor,
        img_perfil: conductorInfo?.img_perfil || null,
        valorado: ratedIds.has(String(t.id)),
      };
    });

    return res.status(200).json({
      status: "Success",
      evento_id: eventoId,
      trayectos: data,
    });
  } catch (error) {
    console.error("Error en obtenerTrayectosPorEvento:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo trayectos por evento",
    });
  }
}

async function buscarTrayectosPorEvento(req, res) {
  const { eventoId } = req.params;
  const { lat, lng, direccion, radius, ciudad, fecha } = req.query;

  if (!eventoId) {
    return res.status(400).send({
      status: "Error",
      message: "eventoId es obligatorio",
    });
  }

  let userLat = parseFloat(lat);
  let userLng = parseFloat(lng);

  if (isNaN(userLat) || isNaN(userLng)) {
    if (ciudad) {
      try {
        const coords = await GoogleMapsProvider.geocodeAddress(
          String(ciudad).trim(),
        );
        userLat = coords.lat;
        userLng = coords.lng;
        console.log(
          "[buscarTrayectosPorEvento] Ciudad geocodificada:",
          ciudad,
          userLat,
          userLng,
        );
      } catch (e) {
        return res.status(400).send({
          status: "Error",
          message: "No se pudo geocodificar la ciudad proporcionada",
        });
      }
    } else {
      return res.status(400).send({
        status: "Error",
        message: "Debes proporcionar lat/lng o ciudad",
      });
    }
  }

  const searchRadiusKm = parseFloat(radius) || SEARCH_DISTANCE_KM;
  const dir = (direccion ?? "").toString().trim().toLowerCase();
  const f = (fecha ?? "").toString().trim();

  try {
    const { headers } = getAuthHeaders(req);
    const eventoInfo = await UsersAPI.fetchEventoInfo(eventoId, { headers });
    if (!eventoInfo?.event?.latitude || !eventoInfo?.event?.longitude) {
      return res.status(404).send({
        status: "Error",
        message: "No se pudieron obtener las coordenadas del evento",
      });
    }

    const eventoLat = parseFloat(eventoInfo.event.latitude);
    const eventoLng = parseFloat(eventoInfo.event.longitude);

    const where = {
      evento_id: eventoId,
      disponible: { gte: 1 },
      status: { notIn: TRAYECTO_INACTIVE_STATUSES },
    };

    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      where.hora = {
        gte: new Date(`${f}T00:00:00.000Z`),
        lte: new Date(`${f}T23:59:59.999Z`),
      };
    }

    // Obtener trayectos del evento con Tramos
    let rows = await prisma.trayecto.findMany({
      where,
      orderBy: { hora: "asc" },
      include: {
        Tramos: {
          orderBy: { step_order: "asc" },
          select: { lat: true, lng: true, address: true, step_order: true },
        },
      },
    });

    if (dir === "ida") {
      rows = rows.filter(
        (t) =>
          t.destino_lat != null &&
          Math.abs(t.destino_lat - eventoLat) < 0.01 &&
          Math.abs(t.destino_lng - eventoLng) < 0.01,
      );
    } else if (dir === "vuelta") {
      rows = rows.filter(
        (t) =>
          t.origen_lat != null &&
          Math.abs(t.origen_lat - eventoLat) < 0.01 &&
          Math.abs(t.origen_lng - eventoLng) < 0.01,
      );
    }

    // Usar R-Tree para búsqueda espacial si se proporcionan coordenadas de usuario
    let filtered = rows;
    if (!isNaN(userLat) && !isNaN(userLng)) {
      const { globalSpatialIndex } =
        await import("../services/routing/spatial-index.js");
      const { RoutingEngine } =
        await import("../services/routing/routing-engine.js");

      // Buscar trayectos cercanos a la ubicación del usuario
      const nearbyMatches = globalSpatialIndex.searchNearbySegments(
        userLat,
        userLng,
        searchRadiusKm,
      );
      const nearbyTrayectoIds = new Set(
        nearbyMatches.map((m) => m.entry.trayectoId),
      );

      if (nearbyTrayectoIds.size > 0) {
        // Filtrar trayectos que están en el R-Tree y coinciden con el evento
        rows = rows.filter((t) => nearbyTrayectoIds.has(t.id));
      } else {
        // Fallback: filtrado por distancia haversine tradicional
        rows = rows.filter((t) => {
          const dOrigin = haversineKm(
            userLat,
            userLng,
            t.origen_lat,
            t.origen_lng,
          );
          if (dOrigin <= searchRadiusKm) return true;

          const tramos = t.Tramos ?? [];
          const hasTramoMatch = tramos.some(
            (tr) =>
              haversineKm(userLat, userLng, tr.lat, tr.lng) <= searchRadiusKm,
          );
          return hasTramoMatch;
        });
      }
    } else {
      // Fallback: filtrado por distancia haversine tradicional
      rows = rows.filter((t) => {
        const dOrigin = haversineKm(
          userLat,
          userLng,
          t.origen_lat,
          t.origen_lng,
        );
        if (dOrigin <= searchRadiusKm) return true;

        const tramos = t.Tramos ?? [];
        const hasTramoMatch = tramos.some(
          (tr) =>
            haversineKm(userLat, userLng, tr.lat, tr.lng) <= searchRadiusKm,
        );
        return hasTramoMatch;
      });
    }

    filtered = rows;

    // Enriquecer con geometría y info de conductor
    const conductorIds = [...new Set(rows.map((t) => String(t.conductor)))];
    const usersList = await UsersAPI.fetchUsersByIds(conductorIds);
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    const userId = req.user?.id;
    const ratedIds = await getRatedTrayectoIdsForUser(
      userId,
      rows.map((t) => t.id),
    );

    const data = rows.map((t) => {
      const conductorInfo = usersMap.get(String(t.conductor));
      const tramos = t.Tramos ?? [];

      // Usar RouteGeometryService para resolver la ruta (O(1) si tiene overview_polyline, fallback si no)
      const route = RouteGeometryService.resolvePolyline(t, {
        zoom: 14,
        precision: "simplified",
        format: "both", // Devolver tanto encodedPolyline como geometry
      });

      return {
        ...t,
        Tramos: undefined,
        conductor: conductorInfo?.name || "Desconocido",
        conductor_id: t.conductor,
        img_perfil: conductorInfo?.img_perfil || null,
        valorado: ratedIds.has(String(t.id)),
        distancia_km:
          Math.round(
            haversineKm(userLat, userLng, t.origen_lat, t.origen_lng) * 100,
          ) / 100,
        puntosClave: route.keyPoints,
        geometry: route.geometry,
        encodedPolyline: route.encodedPolyline, // NUEVO: Siempre incluido
      };
    });

    return res.status(200).json({
      status: "Success",
      evento_id: eventoId,
      user_location: { lat: userLat, lng: userLng },
      search_radius_km: searchRadiusKm,
      ...(ciudad && { ciudad: String(ciudad).trim() }),
      ...(f && { fecha: f }),
      direccion: dir || null,
      total: data.length,
      trayectos: data,
    });
  } catch (error) {
    console.error("Error en buscarTrayectosPorEvento:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error buscando trayectos por evento cerca del usuario",
    });
  }
}

async function obtenerEstadoTrayectoPasajero(req, res) {
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
      origen_lat: true,
      origen_lng: true,
      destino_lat: true,
      destino_lng: true,
    },
  });

  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const reserva = await prisma.reserva.findFirst({
    where: {
      id_trayecto: trayectoId,
      user_id: userId,
      NOT: { status: "canceled" },
    },
    select: { id_reserva: true, status: true, trip_outcome: true },
  });

  if (!reserva) {
    return res.status(403).send({
      status: "Error",
      message: "No tienes una reserva activa en este trayecto",
    });
  }

  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: trayectoId },
    orderBy: { created_at: "asc" },
    include: {
      TipoEvento: { select: { id: true, nombre: true } },
    },
  });

  const nombresEventos = new Set(eventos.map((e) => e.TipoEvento?.nombre));

  const eventoRecogida = eventos.find(
    (e) =>
      e.TipoEvento?.nombre === "recogida" &&
      e.id_reserva === reserva.id_reserva,
  );

  const eventoLlegada = eventos.find(
    (e) =>
      e.TipoEvento?.nombre === "llegada_destino" &&
      e.id_reserva === reserva.id_reserva,
  );

  const conductorInfo = await UsersAPI.fetchUserPublicInfo(
    String(trayecto.conductor),
  );

  const estadoTrayecto = String(trayecto.status ?? "").toLowerCase();
  let faseTrayecto = "pendiente";
  if (estadoTrayecto === TRAYECTO_STATUS.EN_CURSO) faseTrayecto = "en_curso";
  else if (estadoTrayecto === TRAYECTO_STATUS.FINALIZADO)
    faseTrayecto = "finalizado";
  else if (estadoTrayecto === TRAYECTO_STATUS.CANCELADO)
    faseTrayecto = "cancelado";

  let fasePasajero = "esperando_recogida";
  if (eventoLlegada) fasePasajero = "en_destino";
  else if (eventoRecogida) fasePasajero = "en_ruta";

  return res.status(200).json({
    status: "Success",
    trayecto: {
      id: trayecto.id,
      origen: trayecto.origen,
      destino: trayecto.destino,
      hora: trayecto.hora,
      status: trayecto.status,
      fase: faseTrayecto,
      conductor: conductorInfo?.name || "Desconocido",
      conductor_id: trayecto.conductor,
      img_perfil: conductorInfo?.img_perfil || null,
    },
    reserva: {
      id_reserva: reserva.id_reserva,
      status: reserva.status,
      trip_outcome: reserva.trip_outcome,
    },
    pasajero: {
      recogido: !!eventoRecogida,
      en_destino: !!eventoLlegada,
      fase: fasePasajero,
      evento_recogida: eventoRecogida
        ? {
            id: eventoRecogida.id,
            lat: eventoRecogida.lat,
            lng: eventoRecogida.lng,
            created_at: eventoRecogida.created_at,
          }
        : null,
      evento_llegada: eventoLlegada
        ? {
            id: eventoLlegada.id,
            lat: eventoLlegada.lat,
            lng: eventoLlegada.lng,
            created_at: eventoLlegada.created_at,
          }
        : null,
    },
    eventos_trayecto: {
      iniciado: nombresEventos.has("comienzo"),
      finalizado: nombresEventos.has("finalizacion"),
      hay_recogidas: eventos.some((e) => e.TipoEvento?.nombre === "recogida"),
      hay_llegadas: eventos.some(
        (e) => e.TipoEvento?.nombre === "llegada_destino",
      ),
    },
    eventos: eventos.map((e) => ({
      id: e.id,
      id_trayecto: e.id_trayecto,
      id_reserva: e.id_reserva,
      user_id: e.user_id,
      tipo_evento: e.TipoEvento,
      lat: e.lat,
      lng: e.lng,
      created_at: e.created_at,
    })),
  });
}

async function adminGetAllTrayectos(req, res) {
  try {
    const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
    const { status, conductor, evento_id, fechaDesde, fechaHasta, search } =
      req.query;

    const where = {};

    if (status) {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (conductor) {
      where.conductor = conductor;
    }

    if (evento_id) {
      where.evento_id = evento_id;
    }

    if (fechaDesde || fechaHasta) {
      where.hora = {};
      if (fechaDesde) {
        where.hora.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        where.hora.lte = new Date(fechaHasta);
      }
    }

    if (search) {
      where.OR = [
        { origen: { contains: search } },
        { destino: { contains: search } },
      ];
    }

    const orderBy = req.query.orderBy
      ? { [req.query.orderBy]: req.query.order || "desc" }
      : { created_at: "desc" };

    const [trayectos, total] = await Promise.all([
      prisma.trayecto.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.trayecto.count({ where }),
    ]);

    const conductorIds = [...new Set(trayectos.map((t) => t.conductor))];
    const usersList =
      conductorIds.length > 0
        ? await UsersAPI.fetchUsersByIds(conductorIds)
        : [];
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    const data = trayectos.map((t) => {
      const conductorInfo = usersMap.get(String(t.conductor));
      return {
        ...t,
        conductor_nombre: conductorInfo?.name ?? null,
        conductor_email: conductorInfo?.email ?? null,
      };
    });

    return res.status(200).json({
      status: "Success",
      data,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en adminGetAllTrayectos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo trayectos (admin)",
    });
  }
}

async function adminGetTrayectoById(req, res) {
  try {
    const { id } = req.params;
    const trayecto = await prisma.trayecto.findUnique({
      where: { id },
      include: {
        Reservas: true,
        Tramos: { orderBy: { step_order: "asc" } },
      },
    });

    if (!trayecto) {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }

    const conductorInfo = await UsersAPI.fetchUserPublicInfo(
      String(trayecto.conductor),
    );

    const eventos = await prisma.eventoTrayecto.findMany({
      where: { id_trayecto: id },
      include: { TipoEvento: { select: { nombre: true } } },
      orderBy: { created_at: "asc" },
    });

    return res.status(200).json({
      status: "Success",
      data: {
        ...trayecto,
        conductor_nombre: conductorInfo?.name ?? null,
        conductor_email: conductorInfo?.email ?? null,
        eventos: eventos.map((e) => ({
          id: e.id,
          tipo: e.TipoEvento?.nombre ?? null,
          user_id: e.user_id,
          id_reserva: e.id_reserva,
          lat: e.lat,
          lng: e.lng,
          created_at: e.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Error en adminGetTrayectoById:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo trayecto (admin)",
    });
  }
}

async function adminUpdateTrayecto(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.trayecto.findUnique({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }

    const allowedFields = [
      "origen",
      "destino",
      "hora",
      "plazas",
      "disponible",
      "precio",
      "precio_conductor",
      "conductor",
      "vehiculo_id",
      "routeIndex",
      "status",
      "origen_lat",
      "origen_lng",
      "destino_lat",
      "destino_lng",
      "evento_id",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "vehiculo_id") {
          updateData[field] = req.body[field] || null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .send({ status: "Error", message: "No hay campos para actualizar" });
    }

    if (updateData.hora) {
      updateData.hora = new Date(updateData.hora);
    }

    const updated = await prisma.trayecto.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      status: "Success",
      message: "Trayecto actualizado correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("Error en adminUpdateTrayecto:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error actualizando trayecto (admin)",
    });
  }
}

async function adminDeleteTrayecto(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.trayecto.findUnique({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .send({ status: "Error", message: "Trayecto no encontrado" });
    }

    await prisma.$transaction([
      prisma.tramo.deleteMany({ where: { id_trayecto: id } }),
      prisma.recorrido.deleteMany({ where: { id_trayecto: id } }),
      prisma.eventoTrayecto.deleteMany({ where: { id_trayecto: id } }),
      prisma.comment.deleteMany({ where: { id_trayecto: id } }),
      prisma.infoCAEs.deleteMany({ where: { id_trayecto: id } }),
      prisma.pago.deleteMany({ where: { id_trayecto: id } }),
      prisma.reserva.deleteMany({ where: { id_trayecto: id } }),
      prisma.trayecto.delete({ where: { id } }),
    ]);

    // Desindexar trayecto del R-Tree en memoria
    RoutingEngine.removeTrayecto(id);
    console.log(`[adminDeleteTrayecto] Trayecto ${id} desindexado de R-Tree.`);

    return res
      .status(200)
      .json({ status: "Success", message: "Trayecto eliminado correctamente" });
  } catch (error) {
    console.error("Error en adminDeleteTrayecto:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al eliminar el trayecto (admin)",
    });
  }
}

async function getSearchHistory(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).send({
        status: "Error",
        message: "Debes iniciar sesión para ver tu historial",
      });
    }

    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "20", 10), 1),
      100,
    );
    const offset = (page - 1) * limit;

    const where = { user_id: String(userId) };

    const [total, rows] = await Promise.all([
      prisma.trayectoSearchHistory.count({ where }),
      prisma.trayectoSearchHistory.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.status(200).json({
      data: rows,
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
    console.error("Error en getSearchHistory:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al obtener el historial de búsquedas",
    });
  }
}

export const TrayectosController = {
  crearTrayecto,
  crearTrayectoEvento,
  obtenerTrayectos: getTrayectos,
  obtenerTrayectosEnViewport,
  eliminarTrayecto,
  obtenerTrayectoPorId,
  obtenerTrayectoCompleto,
  obtenerEstadoTrayectoPasajero,
  finalizarTrayecto,
  iniciarTrayecto,
  actualizarTrayecto,
  patchTrayecto,
  buscarTrayectos,
  obtenerTrayectosPorConductor,
  obtenerTrayectosPorEvento,
  buscarTrayectosPorEvento,
  obtenerMisTrayectos,
  obtenerProximosTrayectos,
  updateLatLong,
  updateLatLongById,
  adminGetAllTrayectos,
  adminGetTrayectoById,
  adminUpdateTrayecto,
  adminDeleteTrayecto,
  getSearchHistory,
};
