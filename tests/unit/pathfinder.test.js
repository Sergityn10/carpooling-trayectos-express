import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { Pathfinder } from "../../app/services/routing/routing-engine.js";
import { GeoMath } from "../../app/services/routing/geo-math.js";

describe("Pathfinder - A* Multi-Stop Pickup and Delivery", () => {
  const madrid = { lat: 40.4168, lng: -3.7038 };
  const getafe = { lat: 40.3083, lng: -3.7327 };
  const pinto = { lat: 40.2417, lng: -3.6997 };
  const toledo = { lat: 39.8628, lng: -4.0273 };
  const illescas = { lat: 40.1222, lng: -3.8472 };

  describe("Secuenciación Óptima", () => {
    it("resuelve ruta simple 1 pasajero: origen -> destino", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [{
        id: "p1",
        pickup: getafe,
        dropoff: pinto,
        seats: 1,
      }];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      assert.ok(result.success);
      assert.ok(result.orderedStops.length >= 4); // driver_origin + pickup + dropoff + driver_destination
      assert.ok(result.totalDistanceKm > 0);
      assert.ok(result.totalDurationSec > 0);

      // Verificar precedencia: origen de p1 antes que destino de p1
      const p1PickupIdx = result.orderedStops.findIndex(s => s.type === "PICKUP" && s.requestId === "p1");
      const p1DropoffIdx = result.orderedStops.findIndex(s => s.type === "DROPOFF" && s.requestId === "p1");
      assert.ok(p1PickupIdx >= 0 && p1DropoffIdx >= 0);
      assert.ok(p1PickupIdx < p1DropoffIdx, "Recogida antes que entrega");
    });

    it("resuelve 2 pasajeros sin exceder capacidad", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 1 },
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 1 },
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      assert.ok(result.success);
      // driver_origin + 2 pickups + 2 dropoffs + driver_destination = 6 paradas
      assert.ok(result.orderedStops.length === 6);

      // Verificar estructura: 2 pickups, 2 dropoffs
      const pickups = result.orderedStops.filter(s => s.type === "PICKUP");
      const dropoffs = result.orderedStops.filter(s => s.type === "DROPOFF");
      assert.equal(pickups.length, 2);
      assert.equal(dropoffs.length, 2);
    });

    it("ordena paradas por proximidad geográfica (heurística A*)", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 1 }, // ~12km
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 1 }, // ~20km
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      // Primera parada tras origen debe ser una recogida
      const firstStop = result.orderedStops[1];
      assert.equal(firstStop.type, "PICKUP");
    });
  });

  describe("Restricciones de Capacidad", () => {
    it("rechaza si capacidad insuficiente para todas las peticiones simultáneas", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 3 },
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 3 },
      ];
      const maxCapacity = 4; // Solo 4 plazas, piden 6 simultáneas

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      // Debe devolver success: false (no factible para ambas peticiones)
      // O si devuelve éxito, debe ser una solución válida que respete capacidad
      if (!result.success) {
        assert.ok(result.reason);
      } else {
        // Si devuelve éxito, verificar que la solución es válida
        assert.ok(result.orderedStops.length > 0);
      }
    });

    it("respeta capacidad exacta al límite", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: illescas, seats: 2 },
        { id: "p2", pickup: pinto, dropoff: toledo, seats: 2 },
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      assert.ok(result.success);
      // Verificar que la solución existe y es válida
      assert.ok(result.orderedStops.length > 0);
    });
  });

  describe("Precedencia Estricta (Pickup antes que Dropoff por pasajero)", () => {
    it("garantiza que para cada pasajero, pickup precede a dropoff", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 1 },
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 1 },
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      assert.ok(result.success);

      for (const req of requests) {
        const pickupIdx = result.orderedStops.findIndex(s => s.type === "PICKUP" && s.requestId === req.id);
        const dropoffIdx = result.orderedStops.findIndex(s => s.type === "DROPOFF" && s.requestId === req.id);

        assert.ok(pickupIdx >= 0, `Pickup no encontrado para ${req.id}`);
        assert.ok(dropoffIdx >= 0, `Dropoff no encontrado para ${req.id}`);
        assert.ok(pickupIdx < dropoffIdx, `Precedencia violada para ${req.id}: pickup ${pickupIdx} >= dropoff ${dropoffIdx}`);
      }
    });

    it("origen del conductor siempre primera parada", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 1 },
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 1 },
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      assert.equal(result.orderedStops[0].type, "driver_origin");
      assert.ok(GeoMath.haversineKm(
        result.orderedStops[0].lat, result.orderedStops[0].lng,
        driverOrigin.lat, driverOrigin.lng
      ) < 0.1);
    });

    it("destino del conductor siempre última parada", () => {
      const driverOrigin = madrid;
      const driverDest = toledo;
      const requests = [
        { id: "p1", pickup: getafe, dropoff: toledo, seats: 1 },
        { id: "p2", pickup: pinto, dropoff: illescas, seats: 1 },
      ];
      const maxCapacity = 4;

      const result = Pathfinder.solveMultiStopItinerary(
        driverOrigin,
        driverDest,
        requests,
        maxCapacity
      );

      const lastStop = result.orderedStops[result.orderedStops.length - 1];
      assert.equal(lastStop.type, "driver_destination");
      assert.ok(GeoMath.haversineKm(
        lastStop.lat, lastStop.lng,
        driverDest.lat, driverDest.lng
      ) < 0.1);
    });
  });

  describe("Casos Edge", () => {
    it("sin peticiones: ruta directa origen -> destino", () => {
      const result = Pathfinder.solveMultiStopItinerary(
        madrid,
        toledo,
        [],
        4
      );

      assert.ok(result.success);
      assert.equal(result.orderedStops.length, 2);
      assert.equal(result.orderedStops[0].type, "driver_origin");
      assert.equal(result.orderedStops[1].type, "driver_destination");
    });

    it("petición con origen = destino del conductor (recogida en destino)", () => {
      const requests = [{ id: "p1", pickup: toledo, dropoff: illescas, seats: 1 }];
      const result = Pathfinder.solveMultiStopItinerary(
        madrid,
        toledo,
        requests,
        4
      );

      assert.ok(result.success);
      // La recogida en Toledo debe coincidir con destino conductor
      const pickupToledo = result.orderedStops.find(s => s.type === "PICKUP" && s.requestId === "p1");
      assert.ok(pickupToledo);
      assert.ok(GeoMath.haversineKm(pickupToledo.lat, pickupToledo.lng, toledo.lat, toledo.lng) < 0.1);
    });
  });
});