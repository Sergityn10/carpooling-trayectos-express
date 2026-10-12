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
 * Implementa Lazy Deletion (tombstones) + Bulk Loading STR (Sort-Tile-Recursive).
 */
export class SpatialIndex {
  constructor(maxEntries = 9) {
    this.maxEntries = maxEntries;
    this.root = new RTreeNode(true, maxEntries);
    this.trayectosMap = new Map(); // trayectoId -> Array<SegmentEntry>
    this.deadEntriesCount = 0;
    this.totalEntries = 0;
  }

  /**
   * Limpia todo el índice.
   */
  clear() {
    this.root = new RTreeNode(true, this.maxEntries);
    this.trayectosMap.clear();
    this.deadEntriesCount = 0;
    this.totalEntries = 0;
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
    this.totalEntries += segments.length;
  }

  /**
   * Elimina un trayecto y todos sus segmentos del índice (Lazy Deletion).
   * La eliminación física se realiza durante compact() cuando se supera el umbral.
   * @param {string} trayectoId
   */
  removeTrayecto(trayectoId) {
    const segments = this.trayectosMap.get(trayectoId);
    if (!segments) return false;

    this.trayectosMap.delete(trayectoId);
    this.deadEntriesCount += segments.length;
    this.totalEntries -= segments.length;

    // Disparar compactación si la basura supera el 25% o más de 2000 entradas muertas
    const rebuildThreshold = Math.max(2000, this.totalEntries * 0.25);
    if (this.deadEntriesCount > rebuildThreshold) {
      this.compact();
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
        // Lazy Deletion: filtrar entradas de trayectos eliminados
        if (this.trayectosMap.has(entry.trayectoId) && this._intersects(entry, query)) {
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

  /**
   * Reconstruye el árbol completo eliminando entradas muertas (Lazy Deletion).
   * Usa algoritmo STR (Sort-Tile-Recursive) para construcción bulk en O(N log N).
   */
  compact() {
    const allEntries = [];
    for (const segments of this.trayectosMap.values()) {
      allEntries.push(...segments);
    }

    if (allEntries.length === 0) {
      this.root = new RTreeNode(true, this.maxEntries);
      this.deadEntriesCount = 0;
      this.totalEntries = 0;
      return;
    }

    this.root = this._buildSTR(allEntries);
    this.deadEntriesCount = 0;
    this.totalEntries = allEntries.length;
  }

  /**
   * Carga masiva de trayectos usando algoritmo STR (Sort-Tile-Recursive).
   * Reemplaza todo el índice actual.
   * @param {Array<{ trayectoId: string, tramos: Array<{ lat: number, lng: number, address?: string, step_order?: number }>, metadata?: object }>} trayectosData
   */
  loadBulk(trayectosData) {
    if (!trayectosData || trayectosData.length === 0) {
      this.clear();
      return;
    }

    const allEntries = [];
    this.trayectosMap.clear();

    for (const { trayectoId, tramos, metadata = {} } of trayectosData) {
      if (!trayectoId || !tramos || tramos.length === 0) continue;

      const segments = [];
      let cumDistanceKm = 0;

      for (let i = 0; i < tramos.length - 1; i++) {
        const start = tramos[i];
        const end = tramos[i + 1];

        const segDist = GeoMath.haversineKm(
          start.lat, start.lng, end.lat, end.lng
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
        allEntries.push(entry);
      }

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
        allEntries.push(entry);
      }

      this.trayectosMap.set(trayectoId, segments);
    }

    this.root = this._buildSTR(allEntries);
    this.deadEntriesCount = 0;
    this.totalEntries = allEntries.length;
  }

  /**
   * Algoritmo STR (Sort-Tile-Recursive) para construcción R-Tree bulk.
   * Construye un árbol perfectamente balanceado de abajo hacia arriba.
   * @private
   * @param {Array<object>} entries - Array plano de entradas (hojas)
   * @returns {RTreeNode} Nodo raíz del árbol construido
   */
  _buildSTR(entries) {
    const M = this.maxEntries;
    let nodes = this._packLeaves(entries, M);

    // Subir niveles hasta tener una sola raíz
    while (nodes.length > 1) {
      nodes = this._packLevel(nodes, M);
    }

    return nodes[0] || new RTreeNode(true, M);
  }

  /**
   * Empaqueta entradas en nodos hoja (STR nivel 0).
   * @private
   */
  _packLeaves(entries, M) {
    if (entries.length === 0) return [new RTreeNode(true, M)];

    // Ordenar por X (minX)
    entries.sort((a, b) => a.minX - b.minX);

    const S = Math.ceil(Math.sqrt(entries.length / M)); // número de franjas verticales
    const stripSize = Math.ceil(entries.length / S);
    const leafNodes = [];

    for (let i = 0; i < entries.length; i += stripSize) {
      const strip = entries.slice(i, i + stripSize);
      // Ordenar franja por Y (minY)
      strip.sort((a, b) => a.minY - b.minY);

      // Particionar en nodos hoja de tamaño M
      for (let j = 0; j < strip.length; j += M) {
        const leafEntries = strip.slice(j, j + M);
        const leaf = new RTreeNode(true, M);
        leaf.entries = leafEntries;
        leaf.updateBounds();
        leafNodes.push(leaf);
      }
    }

    return leafNodes;
  }

  /**
   * Empaqueta nodos de nivel inferior en nodos de nivel superior (STR recursivo).
   * @private
   */
  _packLevel(nodes, M) {
    // Ordenar por centro X del bounding box
    nodes.sort((a, b) => {
      const cxA = (a.bounds.minX + a.bounds.maxX) / 2;
      const cxB = (b.bounds.minX + b.bounds.maxX) / 2;
      return cxA - cxB;
    });

    const S = Math.ceil(Math.sqrt(nodes.length / M));
    const stripSize = Math.ceil(nodes.length / S);
    const parentNodes = [];

    for (let i = 0; i < nodes.length; i += stripSize) {
      const strip = nodes.slice(i, i + stripSize);
      // Ordenar franja por centro Y
      strip.sort((a, b) => {
        const cyA = (a.bounds.minY + a.bounds.maxY) / 2;
        const cyB = (b.bounds.minY + b.bounds.maxY) / 2;
        return cyA - cyB;
      });

      for (let j = 0; j < strip.length; j += M) {
        const childEntries = strip.slice(j, j + M);
        const parent = new RTreeNode(false, M);
        parent.entries = childEntries;
        parent.updateBounds();
        parentNodes.push(parent);
      }
    }

    return parentNodes;
  }
}

// Instancia singleton para uso global en la aplicación
export const globalSpatialIndex = new SpatialIndex();
