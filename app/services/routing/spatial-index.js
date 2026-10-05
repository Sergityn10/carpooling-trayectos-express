import { GeoMath, getBoundingBox } from "./geo-math.js";

/**
 * Nodo del árbol R-Tree espacial 2D nativo.
 */
class RTreeNode {
  constructor(isLeaf = true, maxEntries = 9) {
    this.isLeaf = isLeaf;
    this.maxEntries = maxEntries;
    this.entries = []; // { minX, minY, maxX, maxY, ...data } o nodos hijos
    this.bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
  }

  updateBounds() {
    this.bounds.minX = Infinity;
    this.bounds.minY = Infinity;
    this.bounds.maxX = -Infinity;
    this.bounds.maxY = -Infinity;

    for (const entry of this.entries) {
      const b = entry.bounds || entry;
      if (b.minX < this.bounds.minX) this.bounds.minX = b.minX;
      if (b.minY < this.bounds.minY) this.bounds.minY = b.minY;
      if (b.maxX > this.bounds.maxX) this.bounds.maxX = b.maxX;
      if (b.maxY > this.bounds.maxY) this.bounds.maxY = b.maxY;
    }
  }
}

/**
 * Índice Espacial R-Tree 2D en memoria para segmentos y trayectos.
 */
export class SpatialIndex {
  constructor(maxEntries = 9) {
    this.maxEntries = maxEntries;
    this.root = new RTreeNode(true, maxEntries);
    this.trayectosMap = new Map(); // trayectoId -> Array<SegmentEntry>
  }

  /**
   * Limpia todo el índice.
   */
  clear() {
    this.root = new RTreeNode(true, this.maxEntries);
    this.trayectosMap.clear();
  }

  /**
   * Añade un conjunto de tramos correspondientes a un trayecto.
   * @param {string} trayectoId
   * @param {Array<{ id?: string, lat: number, lng: number, address?: string, step_order?: number }>} tramos
   * @param {object} [metadata]
   */
  addTrayecto(trayectoId, tramos, metadata = {}) {
    if (!trayectoId || !tramos || tramos.length === 0) return;

    // Si ya existía, remover antes de re-insertar
    if (this.trayectosMap.has(trayectoId)) {
      this.removeTrayecto(trayectoId);
    }

    const segments = [];
    let cumDistanceKm = 0;

    for (let i = 0; i < tramos.length - 1; i++) {
      const start = tramos[i];
      const end = tramos[i + 1];

      const segDist = GeoMath.haversineKm(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
      );

      const entry = {
        minX: Math.min(start.lng, end.lng),
        minY: Math.min(start.lat, end.lat),
        maxX: Math.max(start.lng, end.lng),
        maxY: Math.max(start.lat, end.lat),
        trayectoId,
        stepOrder: start.step_order ?? i,
        start: { lat: start.lat, lng: start.lng, address: start.address },
        end: { lat: end.lat, lng: end.lng, address: end.address },
        segDistKm: segDist,
        cumDistanceKm,
        metadata,
      };

      cumDistanceKm += segDist;
      segments.push(entry);
      this._insert(this.root, entry);
    }

    // Si solo tiene 1 punto (o tramos vacíos), indexar como punto único
    if (tramos.length === 1) {
      const p = tramos[0];
      const entry = {
        minX: p.lng,
        minY: p.lat,
        maxX: p.lng,
        maxY: p.lat,
        trayectoId,
        stepOrder: 0,
        start: { lat: p.lat, lng: p.lng },
        end: { lat: p.lat, lng: p.lng },
        segDistKm: 0,
        cumDistanceKm: 0,
        metadata,
      };
      segments.push(entry);
      this._insert(this.root, entry);
    }

    this.trayectosMap.set(trayectoId, segments);
  }

  /**
   * Elimina un trayecto y todos sus segmentos del índice.
   * @param {string} trayectoId
   */
  removeTrayecto(trayectoId) {
    if (!this.trayectosMap.has(trayectoId)) return false;

    this.trayectosMap.delete(trayectoId);

    // Reconstrucción rápida de las entradas restantes para mantener el árbol balanceado
    const remainingEntries = [];
    for (const segList of this.trayectosMap.values()) {
      for (const entry of segList) {
        remainingEntries.push(entry);
      }
    }

    this.root = new RTreeNode(true, this.maxEntries);
    for (const entry of remainingEntries) {
      this._insert(this.root, entry);
    }

    return true;
  }

  /**
   * Busca segmentos que intersectan o se aproximan a una caja delimitadora.
   * @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} bbox
   * @returns {Array<object>}
   */
  searchBBox(bbox) {
    const results = [];
    const query = {
      minX: bbox.minLng,
      minY: bbox.minLat,
      maxX: bbox.maxLng,
      maxY: bbox.maxLat,
    };
    this._search(this.root, query, results);
    return results;
  }

  /**
   * Busca todos los segmentos y trayectos que pasan a menos de radiusKm de un punto (lat, lng).
   * @param {number} lat
   * @param {number} lng
   * @param {number} radiusKm
   * @returns {Array<{
   *   entry: object,
   *   projectedPoint: { lat: number, lng: number },
   *   distanceKm: number,
   *   t: number
   * }>}
   */
  searchNearbySegments(lat, lng, radiusKm) {
    const bbox = getBoundingBox(lat, lng, radiusKm);
    const candidateEntries = this.searchBBox(bbox);
    const matches = [];

    const queryPoint = { lat, lng };

    for (const entry of candidateEntries) {
      const projection = GeoMath.projectPointOnSegment(
        queryPoint,
        entry.start,
        entry.end,
      );

      if (projection.distanceKm <= radiusKm) {
        matches.push({
          entry,
          projectedPoint: {
            lat: projection.projectedLat,
            lng: projection.projectedLng,
          },
          distanceKm: projection.distanceKm,
          t: projection.t,
        });
      }
    }

    matches.sort((a, b) => a.distanceKm - b.distanceKm);
    return matches;
  }

  /**
   * Obtiene todos los trayectos únicos cercanos a un punto.
   * @param {number} lat
   * @param {number} lng
   * @param {number} radiusKm
   * @returns {Map<string, Array<object>>} Map de trayectoId -> lista de segmentos cercanos
   */
  searchNearbyTrayectoIds(lat, lng, radiusKm) {
    const segmentMatches = this.searchNearbySegments(lat, lng, radiusKm);
    const trayectoMatches = new Map();

    for (const match of segmentMatches) {
      const id = match.entry.trayectoId;
      if (!trayectoMatches.has(id)) {
        trayectoMatches.set(id, []);
      }
      trayectoMatches.get(id).push(match);
    }

    return trayectoMatches;
  }

  /**
   * @private
   */
  _insert(node, entry) {
    if (node.isLeaf) {
      node.entries.push(entry);
      node.updateBounds();
      if (node.entries.length > node.maxEntries) {
        this._splitNode(node);
      }
    } else {
      // Elegir el mejor subárbol (menor expansión de área)
      const bestChild = this._chooseSubtree(node, entry);
      this._insert(bestChild, entry);
      node.updateBounds();
    }
  }

  /**
   * @private
   */
  _chooseSubtree(node, entry) {
    let bestChild = node.entries[0];
    let minEnlargement = Infinity;

    for (const child of node.entries) {
      const enlargement = this._calcEnlargement(child.bounds, entry);
      if (enlargement < minEnlargement) {
        minEnlargement = enlargement;
        bestChild = child;
      }
    }
    return bestChild;
  }

  /**
   * @private
   */
  _calcEnlargement(bounds, entry) {
    const currentArea =
      Math.max(0, bounds.maxX - bounds.minX) *
      Math.max(0, bounds.maxY - bounds.minY);
    const newMinX = Math.min(bounds.minX, entry.minX);
    const newMinY = Math.min(bounds.minY, entry.minY);
    const newMaxX = Math.max(bounds.maxX, entry.maxX);
    const newMaxY = Math.max(bounds.maxY, entry.maxY);
    const newArea = (newMaxX - newMinX) * (newMaxY - newMinY);
    return newArea - currentArea;
  }

  /**
   * @private
   */
  _splitNode(node) {
    const half = Math.floor(node.entries.length / 2);
    // Ordenar por eje X para partición
    node.entries.sort((a, b) => {
      const bA = a.bounds || a;
      const bB = b.bounds || b;
      return bA.minX - bB.minX;
    });

    const newEntries1 = node.entries.slice(0, half);
    const newEntries2 = node.entries.slice(half);

    if (node === this.root) {
      const child1 = new RTreeNode(node.isLeaf, this.maxEntries);
      child1.entries = newEntries1;
      child1.updateBounds();

      const child2 = new RTreeNode(node.isLeaf, this.maxEntries);
      child2.entries = newEntries2;
      child2.updateBounds();

      this.root = new RTreeNode(false, this.maxEntries);
      this.root.entries = [child1, child2];
      this.root.updateBounds();
    }
  }

  /**
   * @private
   */
  _search(node, query, results) {
    if (!this._intersects(node.bounds, query)) return;

    if (node.isLeaf) {
      for (const entry of node.entries) {
        if (this._intersects(entry, query)) {
          results.push(entry);
        }
      }
    } else {
      for (const child of node.entries) {
        this._search(child, query, results);
      }
    }
  }

  /**
   * @private
   */
  _intersects(a, b) {
    return (
      a.minX <= b.maxX &&
      a.maxX >= b.minX &&
      a.minY <= b.maxY &&
      a.maxY >= b.minY
    );
  }
}

// Instancia singleton para uso global en la aplicación
export const globalSpatialIndex = new SpatialIndex();
