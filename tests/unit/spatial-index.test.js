import { describe, it, beforeEach, after } from "node:test";
import { strict as assert } from "node:assert";
import { SpatialIndex, GeoMath } from "../../app/services/routing/routing-engine.js";

describe("SpatialIndex - R-Tree 2D con STR Bulk Loading y Lazy Deletion", () => {
  let index;

  beforeEach(() => {
    index = new SpatialIndex(9);
  });

  after(() => {
    index.clear();
  });

  describe("Insercion Individual vs Bulk Loading", () => {
    const tramosMadrid = [
      { lat: 40.4168, lng: -3.7038, address: "Madrid Centro", step_order: 0 },
      { lat: 40.4000, lng: -3.6900, address: "Atocha", step_order: 1 },
      { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 2 },
    ];

    it("addTrayecto inserta segmentos y actualiza contadores", () => {
      index.addTrayecto("trip-1", tramosMadrid);
      assert.equal(index.totalEntries, 2); // 2 segmentos (3 puntos = 2 tramos)
      assert.equal(index.deadEntriesCount, 0);
      assert.ok(index.trayectosMap.has("trip-1"));
    });

    it("loadBulk carga multiples trayectos de forma masiva con STR", () => {
      const trayectosData = [
        {
          trayectoId: "bulk-1",
          tramos: tramosMadrid.map((t, i) => ({ ...t, step_order: i })),
          metadata: { conductor: "driver-1" },
        },
        {
          trayectoId: "bulk-2",
          tramos: [
            { lat: 41.3851, lng: 2.1734, address: "Barcelona", step_order: 0 },
            { lat: 41.4000, lng: 2.1800, address: "Eixample", step_order: 1 },
          ],
          metadata: { conductor: "driver-2" },
        },
      ];

      index.loadBulk(trayectosData);

      assert.equal(index.trayectosMap.size, 2);
      assert.equal(index.totalEntries, 3); // 2 + 1 segmentos
      assert.ok(index.trayectosMap.has("bulk-1"));
      assert.ok(index.trayectosMap.has("bulk-2"));
    });

    it("loadBulk reconstruye arbol limpio sin entradas muertas", () => {
      index.addTrayecto("trip-old", tramosMadrid);
      index.removeTrayecto("trip-old");
      assert.equal(index.deadEntriesCount, 2);

      index.loadBulk([
        {
          trayectoId: "bulk-new",
          tramos: tramosMadrid.map((t, i) => ({ ...t, step_order: i })),
          metadata: {},
        },
      ]);

      assert.equal(index.deadEntriesCount, 0);
      assert.equal(index.totalEntries, 2);
      assert.ok(!index.trayectosMap.has("trip-old"));
    });
  });

  describe("Busqueda BBox (searchBBox)", () => {
    beforeEach(() => {
      index.addTrayecto("madrid-toledo", [
        { lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 },
        { lat: 40.3000, lng: -3.7500, address: "Getafe", step_order: 1 },
        { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 2 },
      ]);

      index.addTrayecto("barcelona", [
        { lat: 41.3851, lng: 2.1734, address: "Barcelona", step_order: 0 },
        { lat: 41.4000, lng: 2.1800, address: "Eixample", step_order: 1 },
      ]);
    });

    it("encuentra trayectos dentro del BBox", () => {
      const bbox = { minLat: 40.2, maxLat: 40.5, minLng: -3.9, maxLng: -3.5 };
      const results = index.searchBBox(bbox);

      const ids = [...new Set(results.map(r => r.trayectoId))];
      assert.ok(ids.includes("madrid-toledo"));
      assert.ok(!ids.includes("barcelona"));
    });

    it("devuelve array vacio para BBox sin trayectos", () => {
      const bbox = { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }; // Oceano Atlantico
      const results = index.searchBBox(bbox);
      assert.equal(results.length, 0);
    });

    it("encuentra trayectos que cruzan la frontera del BBox", () => {
      index.addTrayecto("cruza-bbox", [
        { lat: 40.50, lng: -3.80, address: "Fuera Norte", step_order: 0 },
        { lat: 40.35, lng: -3.70, address: "Dentro BBox", step_order: 1 },
        { lat: 40.20, lng: -3.60, address: "Fuera Sur", step_order: 2 },
      ]);

      const bbox = { minLat: 40.25, maxLat: 40.45, minLng: -3.75, maxLng: -3.65 };
      const results = index.searchBBox(bbox);

      assert.ok(results.some(r => r.trayectoId === "cruza-bbox"));
    });

    it("filtra correctamente por limite de zoom (precision)", () => {
      // A zoom bajo, searchBBox encuentra segmentos aunque sean largos
      const bboxWide = { minLat: 39.5, maxLat: 41.5, minLng: -4.5, maxLng: 2.5 }; // Toda Espana
      const results = index.searchBBox(bboxWide);

      const uniqueIds = [...new Set(results.map(r => r.trayectoId))];
      assert.ok(uniqueIds.includes("madrid-toledo"));
      assert.ok(uniqueIds.includes("barcelona"));
    });
  });

  describe("Lazy Deletion (removeTrayecto)", () => {
    it("marca trayecto como eliminado en O(1) sin reconstruir arbol", () => {
      // 2 puntos = 1 segmento
      index.addTrayecto("trip-delete", [
        { lat: 40.4168, lng: -3.7038, step_order: 0 },
        { lat: 39.8628, lng: -4.0273, step_order: 1 },
      ]);

      const totalBefore = index.totalEntries;
      const deadBefore = index.deadEntriesCount;

      const result = index.removeTrayecto("trip-delete");

      assert.ok(result);
      assert.equal(index.totalEntries, totalBefore - 1); // 1 segmento
      assert.equal(index.deadEntriesCount, deadBefore + 1);
      assert.ok(!index.trayectosMap.has("trip-delete"));
    });

    it("devuelve false si trayecto no existe", () => {
      const result = index.removeTrayecto("no-existe");
      assert.ok(!result);
    });

    it("busquedas ignoran trayectos eliminados (tombstones)", () => {
      index.addTrayecto("trip-active", [
        { lat: 40.4168, lng: -3.7038, step_order: 0 },
        { lat: 40.3000, lng: -3.7500, step_order: 1 },
      ]);

      index.addTrayecto("trip-deleted", [
        { lat: 40.4168, lng: -3.7038, step_order: 0 },
        { lat: 40.3000, lng: -3.7500, step_order: 1 },
      ]);

      index.removeTrayecto("trip-deleted");

      const bbox = { minLat: 40.2, maxLat: 40.5, minLng: -3.9, maxLng: -3.5 };
      const results = index.searchBBox(bbox);

      const ids = [...new Set(results.map(r => r.trayectoId))];
      assert.ok(ids.includes("trip-active"));
      assert.ok(!ids.includes("trip-deleted"));
    });

    it("compact() purga entradas muertas y reconstruye arbol STR", () => {
      // Anadir varios trayectos (cada uno con 2 puntos = 1 segmento)
      for (let i = 0; i < 10; i++) {
        index.addTrayecto(`trip-${i}`, [
          { lat: 40.4 + i * 0.01, lng: -3.7, step_order: 0 },
          { lat: 40.3 + i * 0.01, lng: -3.8, step_order: 1 },
        ]);
      }

      // Eliminar la mitad
      for (let i = 0; i < 5; i++) {
        index.removeTrayecto(`trip-${i}`);
      }

      assert.ok(index.deadEntriesCount > 0);

      // Compactar
      index.compact();

      assert.equal(index.deadEntriesCount, 0);
      assert.equal(index.trayectosMap.size, 5);
      assert.equal(index.totalEntries, 5); // 5 trayectos * 1 segmento

      // Verificar que busquedas siguen funcionando
      const bbox = { minLat: 40.2, maxLat: 40.6, minLng: -3.9, maxLng: -3.5 };
      const results = index.searchBBox(bbox);
      assert.ok(results.length > 0);
    });
  });

  describe("Auto-compactacion por umbral", () => {
    it("calcula umbral correctamente (max 2000 o 25% de entradas)", () => {
      // Con pocas entradas, el umbral minimo es 2000
      index.addTrayecto("trip-1", [
        { lat: 40.4, lng: -3.7, step_order: 0 },
        { lat: 40.3, lng: -3.8, step_order: 1 },
      ]);
      // totalEntries = 1, umbral = max(2000, 1 * 0.25) = 2000

      // Verificar que totalEntries se actualiza correctamente
      assert.equal(index.totalEntries, 1);

      // Agregar más entradas sin disparar compactación (mantenerse bajo 2000)
      for (let i = 2; i <= 500; i++) {
        index.addTrayecto(`trip-${i}`, [
          { lat: 40.4 + i * 0.001, lng: -3.7, step_order: 0 },
          { lat: 40.3 + i * 0.001, lng: -3.8, step_order: 1 },
        ]);
      }
      // totalEntries = 500, umbral = max(2000, 500 * 0.25) = 2000

      assert.equal(index.totalEntries, 500);
      assert.ok(index.totalEntries < 2000);
    });
  });

  describe("Casos Edge y Robustez", () => {
    it("maneja trayecto con un solo punto (punto unico)", () => {
      index.addTrayecto("single-point", [
        { lat: 40.4168, lng: -3.7038, address: "Solo Madrid", step_order: 0 },
      ]);

      assert.equal(index.totalEntries, 1);
      const entry = index.trayectosMap.get("single-point")[0];
      assert.equal(entry.minX, entry.maxX);
      assert.equal(entry.minY, entry.maxY);
    });

    it("clear() resetea todo el estado", () => {
      index.addTrayecto("trip-1", [
        { lat: 40.4168, lng: -3.7038, step_order: 0 },
        { lat: 39.8628, lng: -4.0273, step_order: 1 },
      ]);
      index.removeTrayecto("trip-1");

      index.clear();

      assert.equal(index.totalEntries, 0);
      assert.equal(index.deadEntriesCount, 0);
      assert.equal(index.trayectosMap.size, 0);
      assert.ok(index.root.isLeaf);
    });

    it("maneja coordenadas en polos y meridianos", () => {
      index.addTrayecto("polar", [
        { lat: 89.9, lng: -179.9, step_order: 0 },
        { lat: -89.9, lng: 179.9, step_order: 1 },
      ]);

      const bbox = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
      const results = index.searchBBox(bbox);
      assert.ok(results.some(r => r.trayectoId === "polar"));
    });
  });
});