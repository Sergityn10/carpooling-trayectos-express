import { randomUUID } from "crypto";
import { prisma } from "../../app/database.js";

/**
 * Genera un UUID v4 simple
 */
export function uuid() {
  return randomUUID();
}

/**
 * Genera coordenadas aleatorias dentro de un radio (km) desde un centro
 */
export function randomCoordsNear(centerLat, centerLng, radiusKm = 10) {
  const latOffset = (Math.random() - 0.5) * (radiusKm / 111) * 2;
  const lngOffset = (Math.random() - 0.5) * (radiusKm / (111 * Math.cos(centerLat * Math.PI / 180))) * 2;
  return {
    lat: centerLat + latOffset,
    lng: centerLng + lngOffset,
  };
}

/**
 * Factoría de Trayecto
 * Crea trayectos con tramos realistas
 */
export async function createTrayectoFactory(overrides = {}) {
  const prisma = getPrisma();

  const conductorId = overrides.conductor || `driver-${uuid()}`;
  const origenLat = overrides.origen_lat ?? 40.4168 + (Math.random() - 0.5) * 0.5;
  const origenLng = overrides.origen_lng ?? -3.7038 + (Math.random() - 0.5) * 0.5;
  const destinoLat = overrides.destino_lat ?? 39.8628 + (Math.random() - 0.5) * 0.5;
  const destinoLng = overrides.destino_lng ?? -4.0273 + (Math.random() - 0.5) * 0.5;

  // Generar tramos intermedios (ruta realista)
  const tramos = generateRouteTramos(origenLat, origenLng, destinoLat, destinoLng);

  const data = {
    id: overrides.id || uuid(),
    origen: overrides.origen || "Madrid",
    destino: overrides.destino || "Toledo",
    hora: overrides.hora || new Date(Date.now() + 3600000), // +1 hora
    plazas: overrides.plazas || 4,
    disponible: overrides.disponible ?? overrides.plazas || 4,
    precio: overrides.precio || 10.0,
    conductor: conductorId,
    vehiculo_id: overrides.vehiculo_id || null,
    origen_lat: origenLat,
    origen_lng: origenLng,
    destino_lat: destinoLat,
    destino_lng: destinoLng,
    status: overrides.status || "programado",
    evento_id: overrides.evento_id || null,
    Tramos: {
      create: tramos.map((t, i) => ({
        lat: t.lat,
        lng: t.lng,
        address: t.address || `Punto ${i + 1}`,
        step_order: i,
      })),
    },
  };

  const trayecto = await prisma.trayecto.create({
    data,
    include: { Tramos: { orderBy: { step_order: "asc" } } },
  });

  return trayecto;
}

/**
 * Genera tramos de ruta realistas entre origen y destino
 */
function generateRouteTramos(origenLat, origenLng, destinoLat, destinoLng) {
  const tramos = [];
  const numTramos = 3 + Math.floor(Math.random() * 4); // 3-6 tramos

  tramos.push({ lat: origenLat, lng: origenLng, address: "Origen" });

  for (let i = 1; i < numTramos; i++) {
    const ratio = i / numTramos;
    const lat = origenLat + (destinoLat - origenLat) * ratio + (Math.random() - 0.5) * 0.02;
    const lng = origenLng + (destinoLng - origenLng) * ratio + (Math.random() - 0.5) * 0.02;
    tramos.push({ lat, lng, address: `Punto intermedio ${i}` });
  }

  tramos.push({ lat: destinoLat, lng: destinoLng, address: "Destino" });

  return tramos;
}

/**
 * Factoría de Reserva
 */
export async function createReservaFactory(trayectoId, userId, overrides = {}) {
  const prisma = getPrisma();

  const reserva = await prisma.reserva.create({
    data: {
      id_reserva: uuid(),
      user_id: userId,
      id_trayecto: trayectoId,
      status: overrides.status || "pending",
      stripe_checkout_session_id: overrides.stripe_checkout_session_id || null,
      stripe_payment_intent_id: overrides.stripe_payment_intent_id || null,
      trip_outcome: overrides.trip_outcome || "pending",
    },
  });

  return reserva;
}

/**
 * Factoría de Ubicación (dirección guardada por usuario)
 */
export async function createUbicacionFactory(userId, overrides = {}) {
  const prisma = getPrisma();

  const coords = randomCoordsNear(40.4168, -3.7038, 20);

  return prisma.ubicacion.create({
    data: {
      id: uuid(),
      lat: coords.lat,
      lng: coords.lng,
      display_name: overrides.display_name || "Dirección de prueba",
      address: overrides.address || "Calle Falsa 123",
      city: overrides.city || "Madrid",
      province: overrides.province || "Madrid",
      country: overrides.country || "España",
      postal_code: overrides.postal_code || "28001",
      type: overrides.type || "home",
      user_id: userId,
    },
  });
}

/**
 * Factoría de Ruta Frecuente
 */
export async function createFrequentRouteFactory(userId, overrides = {}) {
  const prisma = getPrisma();

  const origen = randomCoordsNear(40.4168, -3.7038, 10);
  const destino = randomCoordsNear(39.8628, -4.0273, 10);

  return prisma.frequentRoute.create({
    data: {
      id: uuid(),
      user_id: userId,
      name: overrides.name || "Ruta Casa - Trabajo",
      originAddress: overrides.originAddress || "Madrid Centro",
      originLat: overrides.originLat ?? origen.lat,
      originLng: overrides.originLng ?? origen.lng,
      destAddress: overrides.destAddress || "Toledo Centro",
      destLat: overrides.destLat ?? destino.lat,
      destLng: overrides.destLng ?? destino.lng,
      role: overrides.role || "DRIVER",
      seats: overrides.seats || 3,
    },
  });
}

/**
 * Factoría de Comentario/Opinión
 */
export async function createCommentFactory(trayectoId, commentatorId, targetUserId, overrides = {}) {
  const prisma = getPrisma();

  return prisma.comment.create({
    data: {
      id_comment: uuid(),
      user_id_commentator: commentatorId,
      user_id_trayect: targetUserId,
      id_trayecto: trayectoId,
      opinion: overrides.opinion || "Buen viaje",
      rating: overrides.rating || 5,
    },
  });
}

/**
 * Crea múltiples trayectos en lote para tests de carga
 */
export async function createBulkTrayectos(count, baseOptions = {}) {
  const trayectos = [];
  for (let i = 0; i < count; i++) {
    const trayecto = await createTrayectoFactory({
      ...baseOptions,
      origen: `${baseOptions.origen || "Origen"} ${i}`,
      destino: `${baseOptions.destino || "Destino"} ${i}`,
    });
    trayectos.push(trayecto);
  }
  return trayectos;
}

/**
 * Obtiene el cliente Prisma global
 */
function getPrisma() {
  // Usar el cliente Prisma de la app si está disponible, si no crear uno nuevo
  try {
    const { prisma: appPrisma } = require("../../app/database.js");
    if (appPrisma) return appPrisma;
  } catch (e) {
    // Ignorar y crear propio
  }

  const { getTestPrisma } = require("./test-db.js");
  return getTestPrisma();
}

/**
 * Genera un viewport de mapa para tests
 */
export function createViewport(centerLat = 40.4168, centerLng = -3.7038, sizeDeg = 0.5) {
  const half = sizeDeg / 2;
  return {
    minLat: centerLat - half,
    maxLat: centerLat + half,
    minLng: centerLng - half,
    maxLng: centerLng + half,
    zoom: 12,
  };
}

/**
 * Genera datos para bulk loading del R-Tree
 */
export function generateBulkTrayectosData(count, cities = [
  { name: "Madrid", lat: 40.4168, lng: -3.7038 },
  { name: "Barcelona", lat: 41.3851, lng: 2.1734 },
  { name: "Valencia", lat: 39.4699, lng: -0.3763 },
]) {
  const trayectosData = [];

  for (let i = 0; i < count; i++) {
    const city = cities[i % cities.length];
    const tramos = generateRouteTramos(
      city.lat + (Math.random() - 0.5) * 0.5,
      city.lng + (Math.random() - 0.5) * 0.5,
      city.lat + (Math.random() - 0.5) * 0.5 + 0.3,
      city.lng + (Math.random() - 0.5) * 0.5 + 0.3
    );

    trayectosData.push({
      trayectoId: `bulk-trip-${i}`,
      tramos: tramos.map(t => ({ lat: t.lat, lng: t.lng, address: t.address, step_order: tramos.indexOf(t) })),
      metadata: {
        fecha: new Date().toISOString().split("T")[0],
        hora: new Date(Date.now() + 3600000),
        plazas: 4,
        disponible: 4,
        precio: 10 + Math.random() * 20,
        conductor: `driver-${i % 100}`,
        evento_id: null,
      },
    });
  }

  return trayectosData;
}