import { SpatialIndex, globalSpatialIndex } from "./spatial-index.js";
import { RouteEvaluator } from "./route-evaluator.js";
import { Pathfinder } from "./pathfinder.js";
import {
  DistanceMatrixCache,
  globalDistanceMatrix,
} from "./distance-matrix.js";
import { GeoMath } from "./geo-math.js";
import { MinHeap } from "./min-heap.js";

/**
 * Fachada principal del Motor de Optimización de Rutas y Matching de Trayectos.
 */
export class RoutingEngine {
  /**
   * Inicializa y calienta el índice espacial a partir de la base de datos.
   * Usa Bulk Loading STR (Sort-Tile-Recursive) para rendimiento óptimo.
   * @param {object} prisma Cliente de Prisma
   */
  static async initialize(prisma) {
    console.log(
      "[RoutingEngine] Inicializando índice espacial de trayectos (Bulk STR)...",
    );
    try {
      const activeTrips = await prisma.trayecto.findMany({
        where: {
          status: { in: ["programado", "en curso"] },
          hora: { gte: new Date(Date.now() - 2 * 3600 * 1000) }, // Últimas 2 horas o futuro
        },
        include: {
          Tramos: {
            orderBy: { step_order: "asc" },
          },
        },
      });

      const trayectosData = activeTrips
        .map((trip) => {
          let tramos =
            trip.Tramos && trip.Tramos.length > 0
              ? trip.Tramos.map((t) => ({
                  lat: t.lat,
                  lng: t.lng,
                  address: t.address,
                  step_order: t.step_order,
                }))
              : [];

          // Si no tiene tramos guardados pero sí tiene origen/destino con coordenadas, crear tramo sintético
          if (
            tramos.length === 0 &&
            trip.origen_lat != null &&
            trip.origen_lng != null
          ) {
            tramos.push({
              lat: trip.origen_lat,
              lng: trip.origen_lng,
              address: trip.origen || "",
              step_order: 0,
            });
            if (trip.destino_lat != null && trip.destino_lng != null) {
              tramos.push({
                lat: trip.destino_lat,
                lng: trip.destino_lng,
                address: trip.destino || "",
                step_order: 1,
              });
            }
          }

          if (tramos.length === 0) return null;

          return {
            trayectoId: trip.id,
            tramos,
            metadata: {
              fecha: trip.hora ? trip.hora.toISOString().split("T")[0] : null,
              hora: trip.hora,
              plazas: trip.plazas,
              disponible: trip.disponible,
              precio: trip.precio,
              conductor: trip.conductor,
              evento_id: trip.evento_id,
            },
          };
        })
        .filter(Boolean);

      globalSpatialIndex.loadBulk(trayectosData);

      console.log(
        `[RoutingEngine] Índice espacial inicializado con ${trayectosData.length} trayectos activos (${globalSpatialIndex.totalEntries} segmentos).`,
      );
    } catch (error) {
      console.error(
        "[RoutingEngine] Error al inicializar índice espacial:",
        error?.message ?? error,
      );
    }
  }

  /**
   * Notifica la creación o actualización de un trayecto para indexarlo de inmediato.
   */
  static indexTrayecto(trayecto, tramos) {
    if (!trayecto || !trayecto.id) return;
    let effectiveTramos = tramos && tramos.length > 0 ? tramos : [];
    if (
      effectiveTramos.length === 0 &&
      trayecto.origen_lat != null &&
      trayecto.origen_lng != null
    ) {
      effectiveTramos = [
        {
          lat: trayecto.origen_lat,
          lng: trayecto.origen_lng,
          address: trayecto.origen || "",
          step_order: 0,
        },
      ];
      if (trayecto.destino_lat != null && trayecto.destino_lng != null) {
        effectiveTramos.push({
          lat: trayecto.destino_lat,
          lng: trayecto.destino_lng,
          address: trayecto.destino || "",
          step_order: 1,
        });
      }
    }
    if (effectiveTramos.length === 0) return;

    globalSpatialIndex.addTrayecto(trayecto.id, effectiveTramos, {
      fecha: trayecto.hora
        ? new Date(trayecto.hora).toISOString().split("T")[0]
        : null,
      hora: trayecto.hora,
      plazas: trayecto.plazas,
      disponible: trayecto.disponible,
      precio: trayecto.precio,
      conductor: trayecto.conductor,
      evento_id: trayecto.evento_id,
    });
  }

  /**
   * Notifica la cancelación o eliminación de un trayecto para desindexarlo.
   */
  static removeTrayecto(trayectoId) {
    if (!trayectoId) return;
    globalSpatialIndex.removeTrayecto(trayectoId);
  }

  /**
   * Realiza la búsqueda optimizada de trayectos compatibles con origen, destino y desvíos tolerables.
   * @param {Array<object>} candidateTrips Lista de trayectos cargados con sus Tramos
   * @param {{
   *   origin: { lat: number, lng: number },
   *   destination: { lat: number, lng: number },
   *   targetDate?: string,
   *   seats?: number,
   *   maxDetourKm?: number,
   *   maxDetourMins?: number,
   *   searchRadiusKm?: number
   * }} criteria
   * @returns {Array<object>} Lista de trayectos compatibles enriquecidos con métricas de desvío
   */
  static findCompatibleTrips(candidateTrips, criteria) {
    const {
      origin,
      destination,
      targetDate,
      seats = 1,
      maxDetourKm = 5.0,
      maxDetourMins = 15,
      searchRadiusKm = 2.5,
    } = criteria;

    const matchedTrips = [];

    for (const trip of candidateTrips) {
      // 1. Filtro de disponibilidad
      if (trip.disponible < seats) continue;

      // 2. Filtro de fecha si se proporciona
      if (targetDate) {
        const tripDate = new Date(trip.hora).toISOString().split("T")[0];
        if (tripDate !== targetDate) continue;
      }

      // 3. Evaluación de desvío y proyecciones
      const evalResult = RouteEvaluator.evaluateTripMatch(
        trip,
        trip.Tramos || [],
        {
          origin,
          destination,
          maxDetourKm,
          maxDetourMins,
          searchRadiusKm,
        },
      );

      if (evalResult.isMatch) {
        matchedTrips.push({
          ...trip,
          routingMatch: {
            detourKm: evalResult.detourKm,
            detourMins: evalResult.detourMins,
            detourRatio: evalResult.detourRatio,
            pickupPoint: evalResult.pickupPoint,
            dropoffPoint: evalResult.dropoffPoint,
            passengerRideKm: evalResult.passengerRideKm,
          },
        });
      }
    }

    // Ordenar resultados: primero los de menor desvío, luego por fecha/hora
    matchedTrips.sort((a, b) => {
      const detourDiff =
        (a.routingMatch?.detourKm || 0) - (b.routingMatch?.detourKm || 0);
      if (Math.abs(detourDiff) > 0.5) return detourDiff;
      return new Date(a.hora).getTime() - new Date(b.hora).getTime();
    });

    return matchedTrips;
  }

  /**
   * Planifica el itinerario óptimo con A* para múltiples paradas de recogida.
   */
  static planMultiStopItinerary(
    driverOrigin,
    driverDest,
    requests,
    maxCapacity,
  ) {
    return Pathfinder.solveMultiStopItinerary(
      driverOrigin,
      driverDest,
      requests,
      maxCapacity,
    );
  }
}

export {
  GeoMath,
  MinHeap,
  SpatialIndex,
  globalSpatialIndex,
  DistanceMatrixCache,
  globalDistanceMatrix,
  RouteEvaluator,
  Pathfinder,
};
