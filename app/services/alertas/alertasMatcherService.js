import { prisma } from "../../database.js";
import {
  CHANNELS,
  EVENT_SOURCE,
  MAX_BATCH_RECIPIENTS,
  NOTIFICATION_TYPES,
  TRIP_ALERT_MATCHED,
} from "../../constants/notificationEvents.js";
import { RabbitMQ } from "../../rabbitmq/connection.js";
import { NotificationsAPI } from "../../utils/notifications-api.js";

function extractDriverId(trayecto) {
  const raw =
    trayecto?.organizadorId ??
    trayecto?.driverId ??
    trayecto?.conductor_id ??
    trayecto?.conductor;
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function collectCandidateDestinos(trayecto) {
  const candidates = [
    trayecto?.destino,
    trayecto?.destination,
    trayecto?.destinoCiudad,
  ];
  const unique = [];
  const seen = new Set();

  for (const item of candidates) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }

  return unique;
}

function formatTripDate(trayecto) {
  if (typeof trayecto?.date === "string" && trayecto.date.trim()) {
    return trayecto.date.trim();
  }

  if (typeof trayecto?.fecha === "string" && trayecto.fecha.trim()) {
    const raw = trayecto.fecha.trim();
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  if (trayecto?.hora) {
    const parsed =
      trayecto.hora instanceof Date ? trayecto.hora : new Date(trayecto.hora);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const year = parsed.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  return "";
}

function formatTripTime(trayecto) {
  if (typeof trayecto?.time === "string" && trayecto.time.trim()) {
    return trayecto.time.trim();
  }

  if (typeof trayecto?.hora === "string") {
    const raw = trayecto.hora.trim();
    const hhmmMatch = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (hhmmMatch) {
      return `${hhmmMatch[1].padStart(2, "0")}:${hhmmMatch[2]}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const hh = String(parsed.getUTCHours()).padStart(2, "0");
      const mm = String(parsed.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return raw;
  }

  if (trayecto?.hora instanceof Date && !Number.isNaN(trayecto.hora.getTime())) {
    const hh = String(trayecto.hora.getUTCHours()).padStart(2, "0");
    const mm = String(trayecto.hora.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return "";
}

function formatTripPrice(trayecto) {
  if (typeof trayecto?.price === "string" && trayecto.price.trim()) {
    return trayecto.price.trim();
  }
  const rawPrice = trayecto?.precio ?? trayecto?.price ?? 0;
  const numeric = Number(rawPrice);
  if (Number.isFinite(numeric)) {
    return `${numeric} €`;
  }
  return "0 €";
}

function extractDriverName(trayecto) {
  if (typeof trayecto?.driverName === "string" && trayecto.driverName.trim()) {
    return trayecto.driverName.trim();
  }
  if (
    typeof trayecto?.conductor === "string" &&
    trayecto.conductor.trim() &&
    trayecto?.conductor_id != null &&
    String(trayecto.conductor) !== String(trayecto.conductor_id)
  ) {
    return trayecto.conductor.trim();
  }
  return undefined;
}

/**
 * Busca en una única consulta los usuarioId únicos con alertas activas
 * que coincidan por eventoId o destino, excluyendo siempre al conductor.
 */
async function findMatchedUserIds(trayecto, prismaClient = prisma) {
  if (!trayecto || typeof trayecto !== "object") return [];

  const driverId = extractDriverId(trayecto);
  const rawEventoId = trayecto.eventoId ?? trayecto.evento_id;
  const eventoId =
    rawEventoId != null && String(rawEventoId).trim().length > 0
      ? String(rawEventoId).trim()
      : null;
  const destinos = collectCandidateDestinos(trayecto);

  const orFilters = [];
  if (eventoId) {
    orFilters.push({ tipo: "EVENTO", eventoId });
  }
  if (destinos.length === 1) {
    orFilters.push({ tipo: "DESTINO", destino: destinos[0] });
  } else if (destinos.length > 1) {
    orFilters.push({ tipo: "DESTINO", destino: { in: destinos } });
  }

  if (orFilters.length === 0) {
    return [];
  }

  const rows = await prismaClient.alertaTrayecto.findMany({
    where: {
      activa: true,
      ...(driverId ? { usuarioId: { not: driverId } } : {}),
      OR: orFilters,
    },
    select: { usuarioId: true },
    distinct: ["usuarioId"],
  });

  const uniqueUserIds = [];
  const seen = new Set();

  for (const row of rows ?? []) {
    const uid = row?.usuarioId != null ? String(row.usuarioId).trim() : "";
    if (!uid) continue;
    if (driverId && uid === driverId) continue;
    if (seen.has(uid)) continue;
    seen.add(uid);
    uniqueUserIds.push(uid);
  }

  return uniqueUserIds;
}

/**
 * Divide un array de userIds en bloques de tamaño máximo configurable.
 */
function chunkUserIds(userIds, maxBatchSize = MAX_BATCH_RECIPIENTS) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const size = Math.max(1, Math.floor(maxBatchSize));
  const chunks = [];
  for (let i = 0; i < userIds.length; i += size) {
    chunks.push(userIds.slice(i, i + size));
  }
  return chunks;
}

/**
 * Construye el objeto `data` del evento RabbitMQ `trip.alert.matched`.
 */
function buildTripAlertMatchedData(trayecto, userIdsChunk, chunkIndex = 1) {
  const tripId = String(trayecto?.id ?? trayecto?.tripId ?? "");
  const idempotencyKey = `${TRIP_ALERT_MATCHED}:${tripId}:chunk:${chunkIndex}`;

  const rawSeats = trayecto?.disponible ?? trayecto?.plazas ?? trayecto?.seats;
  const seats =
    rawSeats != null && Number.isFinite(Number(rawSeats))
      ? Number(rawSeats)
      : undefined;

  const driverName = extractDriverName(trayecto);

  return {
    idempotencyKey,
    tripId,
    origin: String(trayecto?.origen ?? trayecto?.origin ?? ""),
    destination: String(trayecto?.destino ?? trayecto?.destination ?? ""),
    date: formatTripDate(trayecto),
    time: formatTripTime(trayecto),
    price: formatTripPrice(trayecto),
    ...(seats !== undefined ? { seats } : {}),
    ...(driverName ? { driverName } : {}),
    channels: [...CHANNELS],
    priority: "high",
    userIds: userIdsChunk,
  };
}

/**
 * Construye el envelope estándar completo para RabbitMQ.
 */
function buildTripAlertMatchedEnvelope(
  data,
  timestamp = new Date().toISOString(),
) {
  return {
    event: TRIP_ALERT_MATCHED,
    source: EVENT_SOURCE,
    timestamp,
    data,
  };
}

/**
 * Construye el payload para el endpoint HTTP fallback `/api/notifications/batch`.
 */
function buildBatchFallbackPayload(data) {
  return {
    idempotencyKey: data.idempotencyKey,
    type: NOTIFICATION_TYPES.TRIP_ALERT_MATCHED,
    channels: data.channels,
    priority: data.priority,
    sharedData: {
      tripId: data.tripId,
      origin: data.origin,
      destination: data.destination,
      date: data.date,
      time: data.time,
      price: data.price,
      ...(data.seats !== undefined ? { seats: data.seats } : {}),
      ...(data.driverName ? { driverName: data.driverName } : {}),
    },
    userIds: data.userIds,
  };
}

/**
 * Ejecuta el matchmaking completo para un trayecto recién creado:
 * consulta única con deduplicación, exclusión de conductor, chunking,
 * idempotencia determinista, publicación RabbitMQ y fallback HTTP batch.
 */
async function processTripAlertMatches(trayecto, deps = {}) {
  const {
    prismaClient = prisma,
    publishRabbitMQ = RabbitMQ.publishEvent,
    sendBatchHttp = NotificationsAPI.sendBatchNotification,
    maxBatchRecipients = MAX_BATCH_RECIPIENTS,
  } = deps;

  const userIds = await findMatchedUserIds(trayecto, prismaClient);
  if (userIds.length === 0) {
    return {
      matchedCount: 0,
      chunksPublished: 0,
      userIds: [],
      payloads: [],
    };
  }

  const chunks = chunkUserIds(userIds, maxBatchRecipients);
  const payloads = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkIndex = i + 1;
    const data = buildTripAlertMatchedData(trayecto, chunks[i], chunkIndex);
    payloads.push(data);

    let published = false;
    try {
      const result = await publishRabbitMQ(
        TRIP_ALERT_MATCHED,
        data,
        EVENT_SOURCE,
      );
      published = result !== false;
    } catch (error) {
      console.error(
        `[AlertasMatcher] Error publicando chunk ${chunkIndex} en RabbitMQ:`,
        error?.message ?? error,
      );
      published = false;
    }

    if (!published && typeof sendBatchHttp === "function") {
      try {
        await sendBatchHttp(buildBatchFallbackPayload(data));
      } catch (fallbackError) {
        console.error(
          `[AlertasMatcher] Error en HTTP fallback batch para chunk ${chunkIndex}:`,
          fallbackError?.message ?? fallbackError,
        );
      }
    }
  }

  return {
    matchedCount: userIds.length,
    chunksPublished: chunks.length,
    userIds,
    payloads,
  };
}

export const AlertasMatcherService = {
  findMatchedUserIds,
  chunkUserIds,
  buildTripAlertMatchedData,
  buildTripAlertMatchedEnvelope,
  buildBatchFallbackPayload,
  processTripAlertMatches,
};
