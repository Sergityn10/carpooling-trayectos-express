/**
 * Utilidades matemáticas y geoespaciales para el cálculo de rutas y proyecciones.
 */

const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distancia en kilómetros
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    isNaN(lat1) ||
    isNaN(lng1) ||
    isNaN(lat2) ||
    isNaN(lng2)
  ) {
    return Infinity;
  }

  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;

  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const a =
    sinDLat2 * sinDLat2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLng2 * sinDLng2;

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calcula la distancia en metros entre dos coordenadas.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/**
 * Convierte un radio en kilómetros a un cuadro delimitador (bounding box) de grados lat/lng.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @returns {{ minLat: number, maxLat: number, minLng: number, maxLng: number }}
 */
export function getBoundingBox(lat, lng, radiusKm) {
  const deltaLat = (radiusKm / EARTH_RADIUS_KM) * RAD_TO_DEG;
  const cosLat = Math.cos(lat * DEG_TO_RAD);
  const deltaLng =
    cosLat > 0.00001
      ? (radiusKm / (EARTH_RADIUS_KM * cosLat)) * RAD_TO_DEG
      : (radiusKm / EARTH_RADIUS_KM) * RAD_TO_DEG;

  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLng: lng - deltaLng,
    maxLng: lng + deltaLng,
  };
}

/**
 * Proyecta ortogonalmente un punto P sobre el segmento vial definido por A y B.
 * Utiliza proyección equirrectangular local para máxima velocidad y precisión local (<100 km).
 * @param {{ lat: number, lng: number }} point
 * @param {{ lat: number, lng: number }} segStart
 * @param {{ lat: number, lng: number }} segEnd
 * @returns {{
 *   projectedLat: number,
 *   projectedLng: number,
 *   t: number,
 *   distanceKm: number
 * }}
 */
export function projectPointOnSegment(point, segStart, segEnd) {
  const latP = point.lat;
  const lngP = point.lng;
  const latA = segStart.lat;
  const lngA = segStart.lng;
  const latB = segEnd.lat;
  const lngB = segEnd.lng;

  // Factor de escala longitudinal basado en la latitud media
  const meanLatRad = ((latA + latB) / 2) * DEG_TO_RAD;
  const cosLat = Math.cos(meanLatRad);

  const dx = (lngB - lngA) * cosLat;
  const dy = latB - latA;

  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 1e-12) {
    const px = (lngP - lngA) * cosLat;
    const py = latP - latA;
    t = (px * dx + py * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projectedLat = latA + t * (latB - latA);
  const projectedLng = lngA + t * (lngB - lngA);

  const distanceKm = haversineKm(latP, lngP, projectedLat, projectedLng);

  return {
    projectedLat,
    projectedLng,
    t,
    distanceKm,
  };
}

/**
 * Calcula la longitud total de una polilínea o lista de puntos en kilómetros.
 * @param {Array<{ lat: number, lng: number }>} points
 * @returns {number} Distancia acumulada en km
 */
export function calculatePolylineDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalKm += haversineKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng,
    );
  }
  return totalKm;
}

/**
 * Estima la duración de un trayecto en segundos según la distancia y el tipo de vía.
 * @param {number} distanceKm
 * @param {number} [averageSpeedKmh=65] Velocidad media estimada en km/h
 * @returns {number} Duración estimada en segundos
 */
export function estimateDurationSec(distanceKm, averageSpeedKmh = 65) {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.round((distanceKm / averageSpeedKmh) * 3600);
}

export const GeoMath = {
  haversineKm,
  haversineMeters,
  getBoundingBox,
  projectPointOnSegment,
  calculatePolylineDistanceKm,
  estimateDurationSec,
};
