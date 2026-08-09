import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { prisma } from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";
import { UsersAPI } from "./users-api.js";
import {
  CAE_STATUS,
  CAE_REPORT_STATUS,
  CAE_REPORT_STATUS_VALUES,
} from "../constants/statuses.js";

dotenv.config();

const KWH_PER_PASSENGER_KM = parseFloat(
  process.env.KWH_PER_PASSENGER_KM || "0.7",
);
const EUR_PER_PASSENGER_KM = parseFloat(
  process.env.EUR_PER_PASSENGER_KM || "0.04",
);

const EARTH_RADIUS_KM = 6371;

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

function totalKmFromPoints(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng,
    );
  }
  return total;
}

async function generateInfoCAE(trayectoId) {
  console.log(`[CAE] Generando informe para trayecto ${trayectoId}`);

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: {
      id: true,
      conductor: true,
      origen_lat: true,
      origen_lng: true,
      destino_lat: true,
      destino_lng: true,
      hora: true,
    },
  });

  if (!trayecto) {
    console.error(`[CAE] Trayecto ${trayectoId} no encontrado`);
    return;
  }

  const pendingStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.PENDING },
  });

  if (!pendingStatus) {
    console.error(`[CAE] Status '${CAE_STATUS.PENDING}' no encontrado en BD`);
    return;
  }

  const existing = await prisma.infoCAEs.findFirst({
    where: { id_trayecto: trayectoId },
  });
  if (existing) {
    console.log(`[CAE] Ya existe informe para trayecto ${trayectoId}`);
    return;
  }

  await prisma.infoCAEs.create({
    data: {
      id: randomUUID(),
      id_trayecto: trayectoId,
      km_recorridos: 0,
      km_with_company: 0,
      kwh_generated: 0,
      status_id: pendingStatus.id,
    },
  });

  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: trayectoId },
    include: { TipoEvento: { select: { nombre: true } } },
    orderBy: { created_at: "asc" },
  });

  const reservas = await prisma.reserva.findMany({
    where: {
      id_trayecto: trayectoId,
      NOT: { status: "canceled" },
    },
    select: { id_reserva: true, user_id: true },
  });

  const pickupEvents = eventos.filter(
    (e) => e.TipoEvento?.nombre === "recogida" && e.id_reserva,
  );
  const dropoffEvents = eventos.filter(
    (e) => e.TipoEvento?.nombre === "llegada_destino" && e.id_reserva,
  );
  const comienzoEvent = eventos.find(
    (e) => e.TipoEvento?.nombre === "comienzo",
  );
  const finalizacionEvent = eventos.find(
    (e) => e.TipoEvento?.nombre === "finalizacion",
  );

  const eventoTipos = eventos.map((e) => e.TipoEvento?.nombre).filter(Boolean);
  console.log(
    `[CAE] Eventos detectados en trayecto ${trayectoId}: [${eventoTipos.join(", ")}]`,
  );
  if (comienzoEvent) {
    console.log(
      `[CAE] Inicio real del trayecto: ${comienzoEvent.created_at.toISOString()} (lat=${comienzoEvent.lat}, lng=${comienzoEvent.lng})`,
    );
  }
  if (finalizacionEvent) {
    console.log(
      `[CAE] Fin real del trayecto: ${finalizacionEvent.created_at.toISOString()} (lat=${finalizacionEvent.lat}, lng=${finalizacionEvent.lng})`,
    );
  }

  // Determinar ventana temporal real del trayecto usando eventos
  const tripStartTime = comienzoEvent ? comienzoEvent.created_at : null;
  const tripEndTime = finalizacionEvent ? finalizacionEvent.created_at : null;

  // Validar si el trayecto terminó lejos del destino planificado
  if (
    finalizacionEvent &&
    finalizacionEvent.lat != null &&
    trayecto.destino_lat != null
  ) {
    const distToDest = haversineKm(
      finalizacionEvent.lat,
      finalizacionEvent.lng,
      trayecto.destino_lat,
      trayecto.destino_lng,
    );
    if (distToDest > 2) {
      console.warn(
        `[CAE] ⚠️ El trayecto ${trayectoId} finalizó a ${distToDest.toFixed(2)} km del destino planificado. ` +
          `Usando coordenadas reales de finalización para el cálculo.`,
      );
    }
  }

  const conductorPointsRaw = await prisma.recorrido.findMany({
    where: { id_trayecto: trayectoId, user_id: trayecto.conductor },
    orderBy: { created_at: "asc" },
    select: { lat: true, lng: true, created_at: true },
  });

  // Filtrar puntos de recorrido al rango temporal real del trayecto
  let filteredPoints = conductorPointsRaw;
  if (tripStartTime || tripEndTime) {
    filteredPoints = conductorPointsRaw.filter((p) => {
      if (tripStartTime && p.created_at < tripStartTime) return false;
      if (tripEndTime && p.created_at > tripEndTime) return false;
      return true;
    });
    if (filteredPoints.length < conductorPointsRaw.length) {
      console.log(
        `[CAE] Filtrados ${conductorPointsRaw.length - filteredPoints.length} puntos de recorrido fuera del rango temporal del trayecto ` +
          `(${filteredPoints.length}/${conductorPointsRaw.length} puntos válidos)`,
      );
    }
  }

  // Construir lista de puntos del conductor: añadir coords de comienzo/finalizacion como extremos reales
  let conductorPoints = filteredPoints;
  if (comienzoEvent && comienzoEvent.lat != null) {
    const startPoint = {
      lat: comienzoEvent.lat,
      lng: comienzoEvent.lng,
      created_at: comienzoEvent.created_at,
    };
    // Solo añadir si no hay un punto de recorrido muy cercano en tiempo
    const hasNearStart =
      filteredPoints.length > 0 &&
      Math.abs(
        filteredPoints[0].created_at.getTime() -
          comienzoEvent.created_at.getTime(),
      ) < 30000;
    if (!hasNearStart) {
      conductorPoints = [startPoint, ...conductorPoints];
    }
  }
  if (finalizacionEvent && finalizacionEvent.lat != null) {
    const endPoint = {
      lat: finalizacionEvent.lat,
      lng: finalizacionEvent.lng,
      created_at: finalizacionEvent.created_at,
    };
    const hasNearEnd =
      filteredPoints.length > 0 &&
      Math.abs(
        filteredPoints[filteredPoints.length - 1].created_at.getTime() -
          finalizacionEvent.created_at.getTime(),
      ) < 30000;
    if (!hasNearEnd) {
      conductorPoints = [...conductorPoints, endPoint];
    }
  }

  // Snap to Roads si hay suficientes puntos
  if (conductorPoints.length >= 2) {
    try {
      console.log(
        `[CAE] Snap to Roads para ${conductorPoints.length} puntos del trayecto ${trayectoId}`,
      );
      const snappedCoords = await GoogleMapsProvider.snapToRoads(
        conductorPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      );

      if (snappedCoords.length === conductorPoints.length) {
        conductorPoints = conductorPoints.map((p, i) => ({
          lat: snappedCoords[i].lat,
          lng: snappedCoords[i].lng,
          created_at: p.created_at,
        }));
        console.log(
          `[CAE] Snap to Roads completado: ${snappedCoords.length} puntos ajustados a carretera`,
        );
      } else {
        console.warn(
          `[CAE] Snap to Roads devolvió ${snappedCoords.length} puntos (esperados ${conductorPoints.length}), usando coordenadas originales`,
        );
      }
    } catch (e) {
      console.warn(
        `[CAE] Error en Snap to Roads, usando coordenadas originales:`,
        e.message,
      );
    }
  }

  // Calcular km_recorridos con prioridad:
  // 1. Suma de segmentos entre puntos reales (recorrido + eventos extremos)
  // 2. Haversine entre coords de comienzo y finalizacion (si hay eventos pero pocos puntos)
  // 3. Haversine entre origen y destino planificados (último recurso)
  let kmRecorridos = 0;
  let kmCalculationMethod = "none";

  if (conductorPoints.length >= 2) {
    kmRecorridos = totalKmFromPoints(conductorPoints);
    kmCalculationMethod = "recorrido+eventos";
  } else if (
    comienzoEvent &&
    comienzoEvent.lat != null &&
    finalizacionEvent &&
    finalizacionEvent.lat != null
  ) {
    kmRecorridos = haversineKm(
      comienzoEvent.lat,
      comienzoEvent.lng,
      finalizacionEvent.lat,
      finalizacionEvent.lng,
    );
    kmCalculationMethod = "comienzo→finalizacion";
    console.warn(
      `[CAE] ⚠️ Sin puntos de recorrido suficientes para trayecto ${trayectoId}. ` +
        `Usando distancia directa comienzo→finalizacion: ${kmRecorridos.toFixed(2)} km`,
    );
  } else if (trayecto.origen_lat != null && trayecto.destino_lat != null) {
    kmRecorridos = haversineKm(
      trayecto.origen_lat,
      trayecto.origen_lng,
      trayecto.destino_lat,
      trayecto.destino_lng,
    );
    kmCalculationMethod = "origen→destino (planificado)";
    console.warn(
      `[CAE] ⚠️ Sin puntos de recorrido ni eventos de comienzo/finalizacion para trayecto ${trayectoId}. ` +
        `Usando distancia planificada origen→destino: ${kmRecorridos.toFixed(2)} km (puede no ser real)`,
    );
  }

  console.log(
    `[CAE] km_recorridos calculados (${kmCalculationMethod}): ${kmRecorridos.toFixed(2)} km`,
  );

  // Advertir si hay muy pocos puntos de recorrido
  if (filteredPoints.length < 2 && conductorPoints.length < 2) {
    console.warn(
      `[CAE] ⚠️ Trayecto ${trayectoId}: solo ${filteredPoints.length} punto(s) de recorrido del conductor. ` +
        `El cálculo puede no ser preciso. Considere revisar el tracking GPS.`,
    );
  }

  const passengerSegments = [];
  for (const pickup of pickupEvents) {
    const dropoff = dropoffEvents.find(
      (d) => d.id_reserva === pickup.id_reserva,
    );
    passengerSegments.push({
      id_reserva: pickup.id_reserva,
      pickupTime: pickup.created_at,
      dropoffTime: dropoff ? dropoff.created_at : null,
    });
  }

  let kmWithCompany = 0;
  let kwhGenerated = 0;
  let eurGenerated = 0;

  if (conductorPoints.length >= 2) {
    for (let i = 1; i < conductorPoints.length; i++) {
      const segStart = conductorPoints[i - 1].created_at;
      const segEnd = conductorPoints[i].created_at;
      const segKm = haversineKm(
        conductorPoints[i - 1].lat,
        conductorPoints[i - 1].lng,
        conductorPoints[i].lat,
        conductorPoints[i].lng,
      );

      const passengersOnSegment = passengerSegments.filter((seg) => {
        const afterPickup = seg.pickupTime <= segEnd;
        const beforeDropoff = !seg.dropoffTime || seg.dropoffTime >= segStart;
        return afterPickup && beforeDropoff;
      });

      if (passengersOnSegment.length > 0) {
        kmWithCompany += segKm;
        kwhGenerated +=
          segKm * passengersOnSegment.length * KWH_PER_PASSENGER_KM;
        eurGenerated +=
          segKm * passengersOnSegment.length * EUR_PER_PASSENGER_KM;
      }
    }
  } else {
    // Fallback: usar kmRecorridos (que ya prioriza comienzo→finalizacion sobre origen→destino)
    const activePassengers = passengerSegments.filter(
      (seg) =>
        !seg.dropoffTime ||
        (tripEndTime
          ? seg.dropoffTime > tripEndTime
          : seg.dropoffTime > trayecto.hora),
    );
    if (activePassengers.length > 0) {
      kmWithCompany = kmRecorridos;
      kwhGenerated =
        kmRecorridos * activePassengers.length * KWH_PER_PASSENGER_KM;
      eurGenerated =
        kmRecorridos * activePassengers.length * EUR_PER_PASSENGER_KM;
    }
  }

  kmRecorridos = Math.round(kmRecorridos * 100) / 100;
  kmWithCompany = Math.round(kmWithCompany * 100) / 100;
  kwhGenerated = Math.round(kwhGenerated * 100) / 100;
  eurGenerated = Math.round(eurGenerated * 100) / 100;

  const inReviewStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.IN_REVIEW },
  });

  await prisma.infoCAEs.updateMany({
    where: { id_trayecto: trayectoId, status_id: pendingStatus.id },
    data: {
      km_recorridos: kmRecorridos,
      km_with_company: kmWithCompany,
      kwh_generated: kwhGenerated,
      eur_generated: eurGenerated,
      status_id: inReviewStatus?.id ?? pendingStatus.id,
    },
  });

  console.log(
    `[CAE] Informe calculado para trayecto ${trayectoId}: ` +
      `${kmRecorridos} km totales, ${kmWithCompany} km acompañado, ${kwhGenerated} kWh generados, ${eurGenerated}€ generados (en revisión)`,
  );
}

async function approveCAE(caeId) {
  const inReviewStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.IN_REVIEW },
  });
  const completedStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.COMPLETED },
  });

  if (!inReviewStatus || !completedStatus) {
    throw new Error("Estados CAE no encontrados en BD");
  }

  const cae = await prisma.infoCAEs.findUnique({
    where: { id: caeId },
  });

  if (!cae) {
    throw new Error("Informe CAE no encontrado");
  }

  if (cae.status_id !== inReviewStatus.id) {
    throw new Error("El informe CAE no está en revisión");
  }

  await prisma.infoCAEs.update({
    where: { id: caeId },
    data: { status_id: completedStatus.id },
  });

  console.log(
    `[CAE] Informe ${caeId} aprobado y marcado como ${CAE_STATUS.COMPLETED}`,
  );
  return cae.id_trayecto;
}

async function getCAEBalance(conductorId) {
  const trayectos = await prisma.trayecto.findMany({
    where: { conductor: conductorId },
    select: { id: true },
  });
  const trayectoIds = trayectos.map((t) => t.id);
  if (trayectoIds.length === 0) {
    return {
      en_revision: 0,
      disponible: 0,
      cancelado: 0,
      total: 0,
      detalles: [],
    };
  }

  const infos = await prisma.infoCAEs.findMany({
    where: { id_trayecto: { in: trayectoIds } },
    include: { StatusInfoCAEs: true },
  });

  let enRevision = 0;
  let disponible = 0;
  let cancelado = 0;

  for (const info of infos) {
    const statusName = info.StatusInfoCAEs?.name ?? CAE_STATUS.PENDING;
    const eur = info.eur_generated ?? 0;
    if (statusName === CAE_STATUS.COMPLETED) {
      disponible += eur;
    } else if (statusName === CAE_STATUS.CANCELED) {
      cancelado += eur;
    } else {
      enRevision += eur;
    }
  }

  const detalles = infos.map((info) => ({
    id: info.id,
    id_trayecto: info.id_trayecto,
    km_recorridos: info.km_recorridos,
    km_with_company: info.km_with_company,
    kwh_generated: info.kwh_generated,
    eur_generated: info.eur_generated,
    status: info.StatusInfoCAEs?.name ?? CAE_STATUS.PENDING,
    created_at: info.created_at,
    updated_at: info.updated_at,
  }));

  return {
    en_revision: Math.round(enRevision * 100) / 100,
    disponible: Math.round(disponible * 100) / 100,
    cancelado: Math.round(cancelado * 100) / 100,
    total: Math.round((enRevision + disponible) * 100) / 100,
    detalles,
  };
}

async function listAllCAEs({ status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (status) {
    const statusRecord = await prisma.statusInfoCAEs.findUnique({
      where: { name: status },
    });
    if (statusRecord) {
      where.status_id = statusRecord.id;
    }
  }

  const skip = (page - 1) * limit;
  const [infos, total] = await Promise.all([
    prisma.infoCAEs.findMany({
      where,
      include: { StatusInfoCAEs: true },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.infoCAEs.count({ where }),
  ]);

  const trayectoIds = [...new Set(infos.map((i) => i.id_trayecto))];
  const trayectos = await prisma.trayecto.findMany({
    where: { id: { in: trayectoIds } },
    select: {
      id: true,
      conductor: true,
      origen: true,
      destino: true,
      hora: true,
    },
  });
  const trayectoMap = new Map(trayectos.map((t) => [t.id, t]));

  const items = infos.map((info) => {
    const trayecto = trayectoMap.get(info.id_trayecto);
    return {
      id: info.id,
      id_trayecto: info.id_trayecto,
      conductor: trayecto?.conductor ?? null,
      origen: trayecto?.origen ?? null,
      destino: trayecto?.destino ?? null,
      hora: trayecto?.hora ?? null,
      km_recorridos: info.km_recorridos,
      km_with_company: info.km_with_company,
      kwh_generated: info.kwh_generated,
      eur_generated: info.eur_generated,
      status: info.StatusInfoCAEs?.name ?? CAE_STATUS.PENDING,
      created_at: info.created_at,
      updated_at: info.updated_at,
    };
  });

  return { items, total, page, limit };
}

async function listCAEsByUser(userId) {
  const trayectos = await prisma.trayecto.findMany({
    where: { conductor: userId },
    select: { id: true, origen: true, destino: true, hora: true },
  });
  const trayectoIds = trayectos.map((t) => t.id);
  const trayectoMap = new Map(trayectos.map((t) => [t.id, t]));

  if (trayectoIds.length === 0) {
    return { items: [], total: 0 };
  }

  const infos = await prisma.infoCAEs.findMany({
    where: { id_trayecto: { in: trayectoIds } },
    include: { StatusInfoCAEs: true },
    orderBy: { created_at: "desc" },
  });

  const items = infos.map((info) => {
    const trayecto = trayectoMap.get(info.id_trayecto);
    return {
      id: info.id,
      id_trayecto: info.id_trayecto,
      origen: trayecto?.origen ?? null,
      destino: trayecto?.destino ?? null,
      hora: trayecto?.hora ?? null,
      km_recorridos: info.km_recorridos,
      km_with_company: info.km_with_company,
      kwh_generated: info.kwh_generated,
      eur_generated: info.eur_generated,
      status: info.StatusInfoCAEs?.name ?? CAE_STATUS.PENDING,
      created_at: info.created_at,
      updated_at: info.updated_at,
    };
  });

  return { items, total: items.length };
}

const KWH_THRESHOLD_MWH = parseFloat(process.env.CAE_KWH_THRESHOLD_MWH || "30");
const KWH_THRESHOLD = KWH_THRESHOLD_MWH * 1000;

async function getPendingCAEsForReport() {
  const pendingStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.IN_REVIEW },
  });
  if (!pendingStatus)
    throw new Error(`Estado '${CAE_STATUS.IN_REVIEW}' no encontrado`);

  const caes = await prisma.infoCAEs.findMany({
    where: {
      status_id: pendingStatus.id,
      report_id: null,
    },
    orderBy: { created_at: "asc" },
  });

  return caes;
}

async function createCAEReport(name) {
  const pendingStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.IN_REVIEW },
  });
  if (!pendingStatus)
    throw new Error(`Estado '${CAE_STATUS.IN_REVIEW}' no encontrado`);

  const caes = await prisma.infoCAEs.findMany({
    where: {
      status_id: pendingStatus.id,
      report_id: null,
    },
    orderBy: { created_at: "asc" },
  });

  if (caes.length === 0) {
    throw new Error("No hay CAEs pendientes de reporte");
  }

  const totalKwh = caes.reduce((sum, c) => sum + c.kwh_generated, 0);
  const totalEur = caes.reduce((sum, c) => sum + c.eur_generated, 0);

  const report = await prisma.cAEReport.create({
    data: {
      id: randomUUID(),
      name: name || `Reporte CAE ${new Date().toISOString().split("T")[0]}`,
      status: CAE_REPORT_STATUS.DRAFT,
      total_kwh: Math.round(totalKwh * 100) / 100,
      total_eur: Math.round(totalEur * 100) / 100,
      total_caes: caes.length,
    },
  });

  await prisma.infoCAEs.updateMany({
    where: { id: { in: caes.map((c) => c.id) } },
    data: { report_id: report.id },
  });

  console.log(
    `[CAE] Reporte ${report.id} creado con ${caes.length} CAEs, ${totalKwh} kWh totales`,
  );

  return {
    id: report.id,
    name: report.name,
    status: report.status,
    total_kwh: report.total_kwh,
    total_eur: report.total_eur,
    total_caes: report.total_caes,
    created_at: report.created_at,
  };
}

async function getCAEReportData(reportId, { headers = {} } = {}) {
  const report = await prisma.cAEReport.findUnique({
    where: { id: reportId },
    include: {
      InfoCAEs: {
        include: { StatusInfoCAEs: true },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!report) throw new Error("Reporte CAE no encontrado");

  const trayectoIds = [...new Set(report.InfoCAEs.map((c) => c.id_trayecto))];
  const trayectos = await prisma.trayecto.findMany({
    where: { id: { in: trayectoIds } },
    select: {
      id: true,
      conductor: true,
      vehiculo_id: true,
      origen: true,
      destino: true,
      hora: true,
      origen_lat: true,
      origen_lng: true,
      destino_lat: true,
      destino_lng: true,
    },
  });
  const trayectoMap = new Map(trayectos.map((t) => [t.id, t]));

  const recorridos = await prisma.recorrido.findMany({
    where: { id_trayecto: { in: trayectoIds } },
    orderBy: { created_at: "asc" },
    select: {
      id_trayecto: true,
      lat: true,
      lng: true,
      address: true,
      created_at: true,
    },
  });
  const recorridosByTrayecto = new Map();
  for (const r of recorridos) {
    if (!recorridosByTrayecto.has(r.id_trayecto)) {
      recorridosByTrayecto.set(r.id_trayecto, []);
    }
    recorridosByTrayecto.get(r.id_trayecto).push(r);
  }

  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: { in: trayectoIds } },
    include: { TipoEvento: { select: { nombre: true } } },
    orderBy: { created_at: "asc" },
  });
  const eventosByTrayecto = new Map();
  for (const e of eventos) {
    if (!eventosByTrayecto.has(e.id_trayecto)) {
      eventosByTrayecto.set(e.id_trayecto, []);
    }
    eventosByTrayecto.get(e.id_trayecto).push(e);
  }

  const reservas = await prisma.reserva.findMany({
    where: { id_trayecto: { in: trayectoIds }, NOT: { status: "canceled" } },
    select: { id_reserva: true, id_trayecto: true, user_id: true },
  });
  const reservasByTrayecto = new Map();
  for (const r of reservas) {
    if (!reservasByTrayecto.has(r.id_trayecto)) {
      reservasByTrayecto.set(r.id_trayecto, []);
    }
    reservasByTrayecto.get(r.id_trayecto).push(r);
  }

  const allUserIds = new Set();
  for (const t of trayectos) {
    allUserIds.add(t.conductor);
  }
  for (const r of reservas) {
    allUserIds.add(r.user_id);
  }
  const allVehicleIds = new Set(
    trayectos.map((t) => t.vehiculo_id).filter(Boolean),
  );

  const [usersInfo, vehiclesInfo] = await Promise.all([
    UsersAPI.fetchUsersByIds([...allUserIds], { headers }),
    Promise.all(
      [...allVehicleIds].map(async (vid) => {
        const info = await UsersAPI.fetchVehicleInfo(vid, { headers });
        return { id: vid, info };
      }),
    ),
  ]);
  const userMap = new Map(usersInfo.map((u) => [u.id, u]));
  const vehicleMap = new Map(vehiclesInfo.map((v) => [v.id, v.info]));

  const items = report.InfoCAEs.map((cae) => {
    const trayecto = trayectoMap.get(cae.id_trayecto);
    const trayectoRecorridos = recorridosByTrayecto.get(cae.id_trayecto) || [];
    const trayectoEventos = eventosByTrayecto.get(cae.id_trayecto) || [];
    const trayectoReservas = reservasByTrayecto.get(cae.id_trayecto) || [];

    const conductorInfo = userMap.get(trayecto?.conductor);
    const vehicleInfo = trayecto?.vehiculo_id
      ? vehicleMap.get(trayecto.vehiculo_id)
      : null;

    const pasajeros = trayectoReservas.map((r) => {
      const userInfo = userMap.get(r.user_id);
      const pickups = trayectoEventos.filter(
        (e) =>
          e.TipoEvento?.nombre === "recogida" && e.id_reserva === r.id_reserva,
      );
      const dropoffs = trayectoEventos.filter(
        (e) =>
          e.TipoEvento?.nombre === "llegada_destino" &&
          e.id_reserva === r.id_reserva,
      );
      return {
        user_id: r.user_id,
        nombre: userInfo?.name ?? null,
        email: userInfo?.email ?? null,
        confirmacion_inicio: pickups.length > 0 ? pickups[0].created_at : null,
        confirmacion_fin: dropoffs.length > 0 ? dropoffs[0].created_at : null,
        inicio_lat: pickups.length > 0 ? pickups[0].lat : null,
        inicio_lng: pickups.length > 0 ? pickups[0].lng : null,
        fin_lat: dropoffs.length > 0 ? dropoffs[0].lat : null,
        fin_lng: dropoffs.length > 0 ? dropoffs[0].lng : null,
      };
    });

    const comienzoEvent = trayectoEventos.find(
      (e) => e.TipoEvento?.nombre === "comienzo",
    );
    const finalizacionEvent = trayectoEventos.find(
      (e) => e.TipoEvento?.nombre === "finalizacion",
    );

    return {
      cae_id: cae.id,
      trayecto_id: cae.id_trayecto,
      estado: cae.StatusInfoCAEs?.name ?? CAE_STATUS.PENDING,
      km_recorridos: cae.km_recorridos,
      km_with_company: cae.km_with_company,
      kwh_generated: cae.kwh_generated,
      eur_generated: cae.eur_generated,
      viaje: {
        origen: trayecto?.origen ?? null,
        destino: trayecto?.destino ?? null,
        hora_programada: trayecto?.hora ?? null,
        hora_inicio_real: comienzoEvent ? comienzoEvent.created_at : null,
        hora_fin_real: finalizacionEvent ? finalizacionEvent.created_at : null,
        inicio_coords:
          comienzoEvent && comienzoEvent.lat != null
            ? { lat: comienzoEvent.lat, lng: comienzoEvent.lng }
            : null,
        fin_coords:
          finalizacionEvent && finalizacionEvent.lat != null
            ? { lat: finalizacionEvent.lat, lng: finalizacionEvent.lng }
            : null,
        origen_coords:
          trayecto?.origen_lat != null
            ? { lat: trayecto.origen_lat, lng: trayecto.origen_lng }
            : null,
        destino_coords:
          trayecto?.destino_lat != null
            ? { lat: trayecto.destino_lat, lng: trayecto.destino_lng }
            : null,
        trazado: trayectoRecorridos.map((r) => ({
          lat: r.lat,
          lng: r.lng,
          address: r.address,
          timestamp: r.created_at,
        })),
      },
      conductor: {
        user_id: trayecto?.conductor ?? null,
        nombre: conductorInfo?.name ?? null,
        email: conductorInfo?.email ?? null,
      },
      vehiculo: vehicleInfo
        ? {
            id: trayecto?.vehiculo_id ?? null,
            matricula: vehicleInfo.plate ?? vehicleInfo.matricula ?? null,
            marca: vehicleInfo.brand ?? vehicleInfo.marca ?? null,
            modelo: vehicleInfo.model ?? vehicleInfo.modelo ?? null,
          }
        : null,
      pasajeros,
      eventos_trayecto: trayectoEventos.map((e) => ({
        tipo: e.TipoEvento?.nombre ?? null,
        user_id: e.user_id ?? null,
        id_reserva: e.id_reserva ?? null,
        lat: e.lat,
        lng: e.lng,
        timestamp: e.created_at,
      })),
      verificacion_unico_vehiculo: trayecto?.vehiculo_id ? true : null,
    };
  });

  return {
    reporte: {
      id: report.id,
      name: report.name,
      status: report.status,
      total_kwh: report.total_kwh,
      total_eur: report.total_eur,
      total_caes: report.total_caes,
      file_url: report.file_url,
      created_at: report.created_at,
      updated_at: report.updated_at,
    },
    items,
  };
}

async function listCAEReports({ status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    prisma.cAEReport.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.cAEReport.count({ where }),
  ]);

  return { items: reports, total, page, limit };
}

async function getCAEReportSummary() {
  const pendingStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.IN_REVIEW },
  });
  const completedStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.COMPLETED },
  });
  const canceledStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: CAE_STATUS.CANCELED },
  });

  const [
    pending,
    inReviewNoReport,
    inReviewWithReport,
    completed,
    canceled,
    reports,
  ] = await Promise.all([
    prisma.infoCAEs.count({
      where: {
        status_id: {
          notIn: [completedStatus?.id, canceledStatus?.id].filter(Boolean),
        },
      },
    }),
    prisma.infoCAEs.count({
      where: { status_id: pendingStatus?.id, report_id: null },
    }),
    prisma.infoCAEs.count({
      where: { status_id: pendingStatus?.id, report_id: { not: null } },
    }),
    prisma.infoCAEs.count({
      where: { status_id: completedStatus?.id },
    }),
    prisma.infoCAEs.count({
      where: { status_id: canceledStatus?.id },
    }),
    prisma.cAEReport.count(),
  ]);

  const pendingKwh = await prisma.infoCAEs.aggregate({
    where: { status_id: pendingStatus?.id, report_id: null },
    _sum: { kwh_generated: true },
  });

  return {
    caes: {
      pendientes_envio: inReviewNoReport,
      enviados_sin_aprobar: inReviewWithReport,
      completados: completed,
      cancelados: canceled,
    },
    kwh_acumulado_pendiente: pendingKwh._sum.kwh_generated ?? 0,
    kwh_umbral_envio: KWH_THRESHOLD,
    reportes_creados: reports,
  };
}

const VALID_REPORT_STATUSES = CAE_REPORT_STATUS_VALUES;

async function updateCAEReportStatus(reportId, newStatus) {
  if (!VALID_REPORT_STATUSES.includes(newStatus)) {
    throw new Error(
      `Estado inválido. Debe ser uno de: ${VALID_REPORT_STATUSES.join(", ")}`,
    );
  }

  const report = await prisma.cAEReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("Reporte CAE no encontrado");
  }

  const updated = await prisma.cAEReport.update({
    where: { id: reportId },
    data: { status: newStatus },
  });

  console.log(`[CAE] Reporte ${reportId} actualizado a estado '${newStatus}'`);

  return {
    id: updated.id,
    name: updated.name,
    status: updated.status,
    total_kwh: updated.total_kwh,
    total_eur: updated.total_eur,
    total_caes: updated.total_caes,
    file_url: updated.file_url,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}

async function deleteCAEReport(reportId) {
  const report = await prisma.cAEReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("Reporte CAE no encontrado");
  }

  await prisma.infoCAEs.updateMany({
    where: { report_id: reportId },
    data: { report_id: null },
  });

  await prisma.cAEReport.delete({
    where: { id: reportId },
  });

  console.log(
    `[CAE] Reporte ${reportId} eliminado. CAEs desvinculados (report_id = null).`,
  );

  return { id: reportId, deleted: true };
}

export const CAEUtils = {
  generateInfoCAE,
  getCAEBalance,
  approveCAE,
  listAllCAEs,
  listCAEsByUser,
  createCAEReport,
  getCAEReportData,
  listCAEReports,
  getCAEReportSummary,
  updateCAEReportStatus,
  deleteCAEReport,
};
