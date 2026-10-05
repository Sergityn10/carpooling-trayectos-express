import { MinHeap } from "./min-heap.js";
import { GeoMath } from "./geo-math.js";
import { globalDistanceMatrix } from "./distance-matrix.js";

/**
 * Motor de secuenciación y enrutamiento multi-parada (A* & Dijkstra para PDP).
 */
export class Pathfinder {
  /**
   * Optimiza el orden de paradas para un conductor y un conjunto de pasajeros (recogidas y entregas).
   * @param {{ lat: number, lng: number }} driverOrigin
   * @param {{ lat: number, lng: number }} driverDest
   * @param {Array<{
   *   id: string,
   *   passengerId?: string,
   *   pickup: { lat: number, lng: number, address?: string },
   *   dropoff: { lat: number, lng: number, address?: string },
   *   seats?: number
   * }>} requests
   * @param {number} [maxCapacity=4]
   * @returns {{
   *   success: boolean,
   *   orderedStops: Array<object>,
   *   totalDistanceKm: number,
   *   totalDurationSec: number,
   *   exploredNodes: number
   * }}
   */
  static solveMultiStopItinerary(
    driverOrigin,
    driverDest,
    requests = [],
    maxCapacity = 4,
  ) {
    if (!requests || requests.length === 0) {
      const dist = GeoMath.haversineKm(
        driverOrigin.lat,
        driverOrigin.lng,
        driverDest.lat,
        driverDest.lng,
      );
      return {
        success: true,
        orderedStops: [
          { type: "driver_origin", ...driverOrigin },
          { type: "driver_destination", ...driverDest },
        ],
        totalDistanceKm: Math.round(dist * 1.2 * 100) / 100,
        totalDurationSec: GeoMath.estimateDurationSec(dist * 1.2),
        exploredNodes: 1,
      };
    }

    // Lista de waypoints a visitar
    // Cada request genera 2 waypoints: PICKUP y DROPOFF
    const stops = [];
    const nRequests = requests.length;

    for (let i = 0; i < nRequests; i++) {
      const req = requests[i];
      const seats = req.seats || 1;

      stops.push({
        id: `P_${i}`,
        requestId: req.id || String(i),
        type: "PICKUP",
        reqIndex: i,
        seatsChange: +seats,
        location: req.pickup,
      });

      stops.push({
        id: `D_${i}`,
        requestId: req.id || String(i),
        type: "DROPOFF",
        reqIndex: i,
        seatsChange: -seats,
        location: req.dropoff,
      });
    }

    const totalStops = stops.length;
    const allStopsMask = (1 << totalStops) - 1;

    // Estado inicial en la búsqueda A*
    const initialLocation = driverOrigin;
    const heap = new MinHeap((a, b) => a.fScore - b.fScore);

    // Heurística admisible: distancia euclidiana mínima para alcanzar el destino final
    const h0 = this._calculateHeuristic(initialLocation, 0, stops, driverDest);

    heap.push({
      location: initialLocation,
      visitedMask: 0,
      currentOccupancy: 0,
      path: [{ type: "driver_origin", ...driverOrigin }],
      gScore: 0, // Distancia acumulada
      fScore: h0,
    });

    let exploredNodes = 0;
    let bestSolution = null;

    // Búsqueda A* asistida por Min-Heap
    while (!heap.isEmpty()) {
      const current = heap.pop();
      exploredNodes++;

      // ¿Hemos visitado todos los puntos de recogida y bajada?
      if (current.visitedMask === allStopsMask) {
        // Enlazar al destino final del conductor
        const finalLeg = globalDistanceMatrix.getDistanceAndDuration(
          current.location.lat,
          current.location.lng,
          driverDest.lat,
          driverDest.lng,
        );

        const totalKm = current.gScore + finalLeg.distanceKm;
        const totalDurationSec =
          GeoMath.estimateDurationSec(totalKm) + (totalStops / 2) * 120; // +2m por parada

        bestSolution = {
          success: true,
          orderedStops: [
            ...current.path,
            { type: "driver_destination", ...driverDest },
          ],
          totalDistanceKm: Math.round(totalKm * 100) / 100,
          totalDurationSec,
          exploredNodes,
        };
        break; // A* garantiza optimalidad al extraer el estado objetivo
      }

      // Probar transiciones a paradas no visitadas
      for (let i = 0; i < totalStops; i++) {
        const isVisited = (current.visitedMask & (1 << i)) !== 0;
        if (isVisited) continue;

        const stop = stops[i];

        // 1. Restricción de Capacidad
        const nextOccupancy = current.currentOccupancy + stop.seatsChange;
        if (nextOccupancy > maxCapacity || nextOccupancy < 0) {
          continue;
        }

        // 2. Restricción de Precedencia (no entregar antes de recoger)
        if (stop.type === "DROPOFF") {
          const correspondingPickupIndex = stop.reqIndex * 2; // El pickup es siempre par (2 * reqIndex)
          const pickupVisited =
            (current.visitedMask & (1 << correspondingPickupIndex)) !== 0;
          if (!pickupVisited) {
            continue; // No se puede entregar si no se ha recogido
          }
        }

        // Calcular coste del tramo
        const leg = globalDistanceMatrix.getDistanceAndDuration(
          current.location.lat,
          current.location.lng,
          stop.location.lat,
          stop.location.lng,
        );

        const nextG = current.gScore + leg.distanceKm;
        const nextMask = current.visitedMask | (1 << i);
        const nextH = this._calculateHeuristic(
          stop.location,
          nextMask,
          stops,
          driverDest,
        );

        heap.push({
          location: stop.location,
          visitedMask: nextMask,
          currentOccupancy: nextOccupancy,
          path: [
            ...current.path,
            {
              type: stop.type,
              requestId: stop.requestId,
              ...stop.location,
            },
          ],
          gScore: nextG,
          fScore: nextG + nextH,
        });
      }
    }

    if (!bestSolution) {
      return {
        success: false,
        reason: "NO_FEASIBLE_ITINERARY",
        exploredNodes,
      };
    }

    return bestSolution;
  }

  /**
   * @private
   * Heurística admisible h(n) para A*
   */
  static _calculateHeuristic(currentLoc, visitedMask, stops, driverDest) {
    let unvisitedPickupCount = 0;
    let maxDistToPending = 0;

    for (let i = 0; i < stops.length; i++) {
      const isVisited = (visitedMask & (1 << i)) !== 0;
      if (!isVisited) {
        const d = GeoMath.haversineKm(
          currentLoc.lat,
          currentLoc.lng,
          stops[i].location.lat,
          stops[i].location.lng,
        );
        if (d > maxDistToPending) maxDistToPending = d;
        if (stops[i].type === "PICKUP") unvisitedPickupCount++;
      }
    }

    const distToFinalDest = GeoMath.haversineKm(
      currentLoc.lat,
      currentLoc.lng,
      driverDest.lat,
      driverDest.lng,
    );

    // Cota inferior admisible con factor de sinuosidad mínimo
    return Math.max(maxDistToPending, distToFinalDest) * 1.1;
  }
}
