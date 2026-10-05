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
   * @param {object} prisma Cliente de Prisma
   */
  static async initialize(prisma) {
    console.log(
      "[RoutingEngine] Inicializando índice espacial de trayectos...",
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

      globalSpatialIndex.clear();

      for (const trip of activeTrips) {
        if (trip.Tramos && trip.Tramos.length > 0) {
          globalSpatialIndex.addTrayecto(trip.id, trip.Tramos, {
            fecha: trip.hora ? trip.hora.toISOString().split("T")[0] : null,
            hora: trip.hora,
            plazas: trip.plazas,
            disponible: trip.disponible,
            precio: trip.precio,
            conductor: trip.conductor,
            evento_id: trip.evento_id,
          });
        }
      }

      console.log(
        `[RoutingEngine] Índice espacial inicializado con ${activeTrips.length} trayectos activos.`,
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
    globalSpatialIndex.addTrayecto(trayecto.id, tramos || [], {
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
