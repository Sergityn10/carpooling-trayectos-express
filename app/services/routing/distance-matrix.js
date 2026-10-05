import { GeoMath } from "./geo-math.js";

/**
 * Caché LRU de distancias y tiempos entre coordenadas.
 */
export class DistanceMatrixCache {
  /**
   * @param {number} [maxSize=20000]
   */
  constructor(maxSize = 20000) {
    this.maxSize = maxSize;
    this.cache = new Map(); // key -> { distanceKm, durationSec, timestamp }
  }

  /**
   * Genera una clave normalizada para el par origen-destino (precisión de 4 decimales ~ 11m).
   */
  _buildKey(lat1, lng1, lat2, lng2) {
    return `${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`;
  }

  /**
   * Obtiene la distancia y duración calculada o cacheada.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {{ distanceKm: number, durationSec: number }}
   */
  getDistanceAndDuration(lat1, lng1, lat2, lng2) {
    if (lat1 === lat2 && lng1 === lng2) {
      return { distanceKm: 0, durationSec: 0 };
    }

    const key = this._buildKey(lat1, lng1, lat2, lng2);
    const cached = this.cache.get(key);

    if (cached) {
      // Re-insertar al final para mantener orden LRU
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    // Cálculo heurístico con factor de sinuosidad vial (1.20)
    const directKm = GeoMath.haversineKm(lat1, lng1, lat2, lng2);
    const estimatedRoadKm = Math.round(directKm * 1.2 * 100) / 100;
    const durationSec = GeoMath.estimateDurationSec(estimatedRoadKm);

    const result = {
      distanceKm: estimatedRoadKm,
      durationSec,
      timestamp: Date.now(),
    };

    if (this.cache.size >= this.maxSize) {
      // Eliminar el elemento más antiguo (primer elemento del Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, result);
    return result;
  }

  /**
   * Guarda explícitamente un resultado real (por ejemplo obtenido de Google Directions).
   */
  setExact(lat1, lng1, lat2, lng2, distanceKm, durationSec) {
    const key = this._buildKey(lat1, lng1, lat2, lng2);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      distanceKm,
      durationSec,
      timestamp: Date.now(),
      isExact: true,
    });
  }

  /**
   * Limpia la caché.
   */
  clear() {
    this.cache.clear();
  }
}

export const globalDistanceMatrix = new DistanceMatrixCache();
