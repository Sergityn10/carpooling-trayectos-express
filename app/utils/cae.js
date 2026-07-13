import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { prisma } from "../database.js";
import { GoogleMapsProvider } from "../providers/google-maps.js";

dotenv.config();

const KWH_PER_PASSENGER_KM = parseFloat(
  process.env.KWH_PER_PASSENGER_KM || "0.7",
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
    where: { name: "pending" },
  });

  if (!pendingStatus) {
    console.error("[CAE] Status 'pending' no encontrado en BD");
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

  const conductorPointsRaw = await prisma.recorrido.findMany({
    where: { id_trayecto: trayectoId, user_id: trayecto.conductor },
    orderBy: { created_at: "asc" },
    select: { lat: true, lng: true, created_at: true },
  });

  let conductorPoints = conductorPointsRaw;
  if (conductorPointsRaw.length >= 2) {
    try {
      console.log(
        `[CAE] Snap to Roads para ${conductorPointsRaw.length} puntos del trayecto ${trayectoId}`,
      );
      const snappedCoords = await GoogleMapsProvider.snapToRoads(
        conductorPointsRaw.map((p) => ({ lat: p.lat, lng: p.lng })),
      );

      if (snappedCoords.length === conductorPointsRaw.length) {
        conductorPoints = conductorPointsRaw.map((p, i) => ({
          lat: snappedCoords[i].lat,
          lng: snappedCoords[i].lng,
          created_at: p.created_at,
        }));
        console.log(
          `[CAE] Snap to Roads completado: ${snappedCoords.length} puntos ajustados a carretera`,
        );
      } else {
        console.warn(
          `[CAE] Snap to Roads devolvió ${snappedCoords.length} puntos (esperados ${conductorPointsRaw.length}), usando coordenadas originales`,
        );
      }
    } catch (e) {
      console.warn(
        `[CAE] Error en Snap to Roads, usando coordenadas originales:`,
        e.message,
      );
    }
  }

  let kmRecorridos = 0;
  if (conductorPoints.length >= 2) {
    kmRecorridos = totalKmFromPoints(conductorPoints);
  } else if (trayecto.origen_lat != null && trayecto.destino_lat != null) {
    kmRecorridos = haversineKm(
      trayecto.origen_lat,
      trayecto.origen_lng,
      trayecto.destino_lat,
      trayecto.destino_lng,
    );
  }

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
      }
    }
  } else {
    const activePassengers = passengerSegments.filter(
      (seg) => !seg.dropoffTime || seg.dropoffTime > trayecto.hora,
    );
    if (activePassengers.length > 0) {
      kmWithCompany = kmRecorridos;
      kwhGenerated =
        kmRecorridos * activePassengers.length * KWH_PER_PASSENGER_KM;
    }
  }

  kmRecorridos = Math.round(kmRecorridos * 100) / 100;
  kmWithCompany = Math.round(kmWithCompany * 100) / 100;
  kwhGenerated = Math.round(kwhGenerated * 100) / 100;

  const completedStatus = await prisma.statusInfoCAEs.findUnique({
    where: { name: "completed" },
  });

  await prisma.infoCAEs.updateMany({
    where: { id_trayecto: trayectoId, status_id: pendingStatus.id },
    data: {
      km_recorridos: kmRecorridos,
      km_with_company: kmWithCompany,
      kwh_generated: kwhGenerated,
      status_id: completedStatus?.id ?? pendingStatus.id,
    },
  });

  console.log(
    `[CAE] Informe completado para trayecto ${trayectoId}: ` +
      `${kmRecorridos} km totales, ${kmWithCompany} km acompañado, ${kwhGenerated} kWh generados`,
  );
}

export const CAEUtils = {
  generateInfoCAE,
};
