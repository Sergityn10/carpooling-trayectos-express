import { GeoMath } from "./geo-math.js";
import { globalDistanceMatrix } from "./distance-matrix.js";

/**
 * Evaluador de compatibilidad de rutas y desvíos (Detour Evaluation).
 */
export class RouteEvaluator {
  /**
   * Encuentra el punto más cercano de una ruta (lista de tramos) a una coordenada dada.
   * @param {{ lat: number, lng: number }} point
   * @param {Array<{ lat: number, lng: number, step_order?: number }>} tramos
   * @returns {{
   *   bestSegmentIndex: number,
   *   projectedPoint: { lat: number, lng: number },
   *   distanceToRouteKm: number,
   *   progressAlongRouteKm: number,
   *   t: number
   * } | null}
   */
  static findClosestPointOnRoute(point, tramos) {
    if (!tramos || tramos.length === 0) return null;

    if (tramos.length === 1) {
      const dist = GeoMath.haversineKm(
        point.lat,
        point.lng,
        tramos[0].lat,
        tramos[0].lng,
      );
      return {
        bestSegmentIndex: 0,
        projectedPoint: { lat: tramos[0].lat, lng: tramos[0].lng },
        distanceToRouteKm: dist,
        progressAlongRouteKm: 0,
        t: 0,
      };
    }

    let minDistance = Infinity;
    let bestResult = null;
    let accumulatedKm = 0;

    for (let i = 0; i < tramos.length - 1; i++) {
      const segStart = tramos[i];
      const segEnd = tramos[i + 1];
      const segDist = GeoMath.haversineKm(
        segStart.lat,
        segStart.lng,
        segEnd.lat,
        segEnd.lng,
      );

      const proj = GeoMath.projectPointOnSegment(point, segStart, segEnd);

      if (proj.distanceKm < minDistance) {
        minDistance = proj.distanceKm;
        const progressAlongRouteKm = accumulatedKm + segDist * proj.t;

        bestResult = {
          bestSegmentIndex: i,
          projectedPoint: {
            lat: proj.projectedLat,
            lng: proj.projectedLng,
          },
          distanceToRouteKm: proj.distanceKm,
          progressAlongRouteKm,
          t: proj.t,
        };
      }

      accumulatedKm += segDist;
    }

    return bestResult;
  }

  /**
   * Evalúa si un trayecto existente puede recoger a un pasajero, calculando desvíos y comprobando restricciones.
   * @param {object} trayecto Datos del trayecto
   * @param {Array<object>} tramos Tramos del trayecto
   * @param {{
   *   origin: { lat: number, lng: number },
   *   destination: { lat: number, lng: number },
   *   maxDetourKm?: number,
   *   maxDetourMins?: number,
   *   maxDetourRatio?: number,
   *   searchRadiusKm?: number
   * }} options
   * @returns {{
   *   isMatch: boolean,
   *   reason?: string,
   *   detourKm?: number,
   *   detourMins?: number,
   *   pickupPoint?: { lat: number, lng: number, distanceKm: number },
   *   dropoffPoint?: { lat: number, lng: number, distanceKm: number },
   *   driverRouteKm?: number,
   *   passengerRideKm?: number
   * }}
   */
  static evaluateTripMatch(trayecto, tramos, options) {
    const maxDetourKm = options.maxDetourKm ?? 5.0; // 5 km de desvío máximo
    const maxDetourMins = options.maxDetourMins ?? 15; // 15 min de desvío máximo
    const maxDetourRatio = options.maxDetourRatio ?? 0.25; // 25% de incremento de distancia
    const searchRadiusKm = options.searchRadiusKm ?? 2.5; // Radio de búsqueda alrededor de la ruta

    if (!tramos || tramos.length === 0) {
      // Si no tiene tramos, evaluar origen y destino directamente
      const dOrigin = GeoMath.haversineKm(
        options.origin.lat,
        options.origin.lng,
        trayecto.origen_lat,
        trayecto.origen_lng,
      );
      const dDest = GeoMath.haversineKm(
        options.destination.lat,
        options.destination.lng,
        trayecto.destino_lat,
        trayecto.destino_lng,
      );

      const isMatch = dOrigin <= searchRadiusKm && dDest <= searchRadiusKm;
      const detourKm = Math.round((dOrigin + dDest) * 100) / 100;
      const detourMins = Math.round(
        GeoMath.estimateDurationSec(detourKm) / 60 + 2,
      );

      return {
        isMatch,
        reason: isMatch ? "MATCH_DIRECTO" : "DISTANCIA_EXCESIVA_SIN_TRAMOS",
        detourKm,
        detourMins,
        pickupPoint: {
          lat: trayecto.origen_lat,
          lng: trayecto.origen_lng,
          distanceKm: dOrigin,
        },
        dropoffPoint: {
          lat: trayecto.destino_lat,
          lng: trayecto.destino_lng,
          distanceKm: dDest,
        },
      };
    }

    // 1. Proyectar origen y destino del pasajero en la ruta del conductor
    const pickupMatch = this.findClosestPointOnRoute(options.origin, tramos);
    const dropoffMatch = this.findClosestPointOnRoute(
      options.destination,
      tramos,
    );

    if (!pickupMatch || !dropoffMatch) {
      return { isMatch: false, reason: "NO_PROJECTION_FOUND" };
    }

    // 2. Verificar que el punto de recogida esté a una distancia razonable de la ruta
    if (
      pickupMatch.distanceToRouteKm > searchRadiusKm ||
      dropoffMatch.distanceToRouteKm > searchRadiusKm
    ) {
      return {
        isMatch: false,
        reason: "FUERA_DE_RADIO_MAXIMO",
        pickupDistanceKm: pickupMatch.distanceToRouteKm,
        dropoffDistanceKm: dropoffMatch.distanceToRouteKm,
      };
    }

    // 3. Regla fundamental de orden: el progreso de recogida debe ser ANTERIOR al de bajada
    const passengerDistanceAlongRoute =
      dropoffMatch.progressAlongRouteKm - pickupMatch.progressAlongRouteKm;

    if (passengerDistanceAlongRoute <= 0.1) {
      // 100 metros de margen mínimo de viaje
      return {
        isMatch: false,
        reason: "ORDEN_INVERTIDO_O_MISMO_PUNTO",
        pickupProgress: pickupMatch.progressAlongRouteKm,
        dropoffProgress: dropoffMatch.progressAlongRouteKm,
      };
    }

    // 4. Calcular el desvío físico adicional (ida y vuelta a la recogida + ida y vuelta a la bajada)
    const detourKm =
      Math.round(
        (pickupMatch.distanceToRouteKm * 2 +
          dropoffMatch.distanceToRouteKm * 2) *
          100,
      ) / 100;

    const baseTripKm =
      GeoMath.calculatePolylineDistanceKm(tramos) ||
      GeoMath.haversineKm(
        trayecto.origen_lat,
        trayecto.origen_lng,
        trayecto.destino_lat,
        trayecto.destino_lng,
      );

    const detourRatio = baseTripKm > 0 ? detourKm / baseTripKm : 0;
    const detourDurationSec = GeoMath.estimateDurationSec(detourKm) + 180; // +3 min por maniobra/espera
    const detourMins = Math.round(detourDurationSec / 60);

    // 5. Validar umbrales
    const exceedsKm = detourKm > maxDetourKm;
    const exceedsMins = detourMins > maxDetourMins;
    const exceedsRatio = detourRatio > maxDetourRatio && detourKm > 2.0;

    if (exceedsKm || exceedsMins || exceedsRatio) {
      return {
        isMatch: false,
        reason: "DESVIO_EXCEDE_LIMITES",
        detourKm,
        detourMins,
        detourRatio,
      };
    }

    return {
      isMatch: true,
      reason: "MATCH_OPTIMO",
      detourKm,
      detourMins,
      detourRatio,
      pickupPoint: {
        lat: pickupMatch.projectedPoint.lat,
        lng: pickupMatch.projectedPoint.lng,
        distanceKm: Math.round(pickupMatch.distanceToRouteKm * 100) / 100,
        progressKm: Math.round(pickupMatch.progressAlongRouteKm * 100) / 100,
      },
      dropoffPoint: {
        lat: dropoffMatch.projectedPoint.lat,
        lng: dropoffMatch.projectedPoint.lng,
        distanceKm: Math.round(dropoffMatch.distanceToRouteKm * 100) / 100,
        progressKm: Math.round(dropoffMatch.progressAlongRouteKm * 100) / 100,
      },
      driverRouteKm: Math.round(baseTripKm * 100) / 100,
      passengerRideKm: Math.round(passengerDistanceAlongRoute * 100) / 100,
    };
  }
}
