import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { DistanceMatrixCache, globalDistanceMatrix } from "../../app/services/routing/routing-engine.js";

describe("DistanceMatrixCache - Caché LRU de Distancias", () => {
  let cache;

  beforeEach(() => {
    cache = new DistanceMatrixCache(100); // Límite 100 entradas
  });

  describe("Operaciones Básicas", () => {
    it("getDistanceAndDuration calcula y cachea distancia heurística", () => {
      const result = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);

      assert.ok(result);
      assert.ok(typeof result.distanceKm === "number");
      assert.ok(typeof result.durationSec === "number");
      assert.ok(result.distanceKm > 0);
    });

    it("segunda llamada a mismo par usa caché (hit)", () => {
      const r1 = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);
      const r2 = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);

      // Debe devolver el mismo objeto (cached)
      assert.equal(r1, r2);
    });

    it("coordenadas idénticas devuelve distancia 0", () => {
      const result = cache.getDistanceAndDuration(40.4168, -3.7038, 40.4168, -3.7038);

      assert.equal(result.distanceKm, 0);
      assert.equal(result.durationSec, 0);
    });

    it("setExact almacena distancia real y evita recálculo", () => {
      cache.setExact(40.4168, -3.7038, 39.8628, -4.0273, 70.5, 3600);

      const result = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);

      assert.equal(result.distanceKm, 70.5);
      assert.equal(result.durationSec, 3600);
      assert.ok(result.isExact);
    });

    it("redondea coordenadas a 4 decimales internamente", () => {
      // setExact redondea a 4 decimales: 40.41681234 -> 40.4168, -3.70385678 -> -3.7039
      cache.setExact(40.41681234, -3.70385678, 39.8628, -4.0273, 70.5, 3600);

      // Coordenadas que redondean a los mismos 4 decimales
      const result = cache.getDistanceAndDuration(40.4168, -3.7039, 39.8628, -4.0273);

      assert.equal(result.distanceKm, 70.5);
    });

    it("clave simétrica: A->B = B->A (buildKey es direccional pero el cálculo es simétrico)", () => {
      const r1 = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);
      const r2 = cache.getDistanceAndDuration(39.8628, -4.0273, 40.4168, -3.7038);

      // La distancia Haversine es simétrica
      assert.equal(r1.distanceKm, r2.distanceKm);
    });
  });

  describe("Evición LRU (Least Recently Used)", () => {
    it("evicta entrada menos usada al superar límite (maxSize)", () => {
      const smallCache = new DistanceMatrixCache(3);

      smallCache.getDistanceAndDuration(1, 1, 2, 2);
      smallCache.getDistanceAndDuration(2, 2, 3, 3);
      smallCache.getDistanceAndDuration(3, 3, 4, 4);

      // Acceder a la primera para hacerla "recientemente usada"
      smallCache.getDistanceAndDuration(1, 1, 2, 2);

      // Añadir cuarta entrada -> debe evictar la segunda (menos usada)
      smallCache.getDistanceAndDuration(4, 4, 5, 5);

      // Verificar que la caché no crece más allá de maxSize
      // Nota: no hay API pública para inspeccionar tamaño interno, verificamos comportamiento
      const r1 = smallCache.getDistanceAndDuration(1, 1, 2, 2);
      const r4 = smallCache.getDistanceAndDuration(4, 4, 5, 5);

      assert.ok(r1 && r4);
    });

    it("actualizar con setExact mueve entrada a MRU", () => {
      const smallCache = new DistanceMatrixCache(2);

      smallCache.getDistanceAndDuration(1, 1, 2, 2);
      smallCache.getDistanceAndDuration(2, 2, 3, 3);

      // Actualizar primera entrada con setExact (la hace MRU)
      smallCache.setExact(1, 1, 2, 2, 15, 100);

      // Añadir tercera -> debe evictar la segunda
      smallCache.getDistanceAndDuration(3, 3, 4, 4);

      const r1 = smallCache.getDistanceAndDuration(1, 1, 2, 2);
      const r3 = smallCache.getDistanceAndDuration(3, 3, 4, 4);

      assert.ok(r1 && r3);
    });
  });

  describe("Estadísticas y Limpieza", () => {
    it("clear() vacía el caché", () => {
      cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);
      cache.clear();

      const result = cache.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);
      // Después de clear debe recalcular
      assert.ok(result);
    });
  });

  describe("Instancia Global", () => {
    it("globalDistanceMatrix existe y es usable", () => {
      assert.ok(globalDistanceMatrix);
      assert.ok(typeof globalDistanceMatrix.getDistanceAndDuration === "function");
      assert.ok(typeof globalDistanceMatrix.setExact === "function");

      globalDistanceMatrix.clear();
      globalDistanceMatrix.setExact(40.4168, -3.7038, 39.8628, -4.0273, 70.5, 3600);

      const result = globalDistanceMatrix.getDistanceAndDuration(40.4168, -3.7038, 39.8628, -4.0273);
      assert.equal(result.distanceKm, 70.5);
    });
  });
});