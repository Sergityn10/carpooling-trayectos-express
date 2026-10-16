import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { RouteGeometryService } from "../../app/services/routing/geometry-service.js";

describe("RouteGeometryService.resolvePolyline - Optimización de Polilíneas para Mapas", () => {
  it("debe retornar overview_polyline en O(1) cuando está presente sin requerir tramos", () => {
    const coords = [
      [-3.7038, 40.4168],
      [-3.8000, 40.4500],
      [-4.0273, 39.8628],
    ];
    const encoded = RouteGeometryService.encodePolyline(coords);

    const trayecto = {
      id: "test-trip-1",
      origen_lat: 40.4168,
      origen_lng: -3.7038,
      destino_lat: 39.8628,
      destino_lng: -4.0273,
      overview_polyline: encoded,
      Tramos: [], // Sin tramos en el objeto
    };

    const route = RouteGeometryService.resolvePolyline(trayecto, { format: "both" });

    assert.equal(route.encodedPolyline, encoded);
    assert.deepEqual(route.keyPoints.origen, { lat: 40.4168, lng: -3.7038 });
    assert.deepEqual(route.keyPoints.destino, { lat: 39.8628, lng: -4.0273 });
    assert.ok(route.geometry);
    assert.equal(route.geometry.type, "LineString");
    assert.equal(route.geometry.coordinates.length, 3);
  });

  it("debe aplicar fallback a Tramos cuando overview_polyline es null", () => {
    const tramos = [
      { lat: 40.4168, lng: -3.7038, step_order: 0, address: "Origen" },
      { lat: 40.4500, lng: -3.8000, step_order: 1, address: "Punto intermedio" },
      { lat: 39.8628, lng: -4.0273, step_order: 2, address: "Destino" },
    ];

    const trayecto = {
      id: "test-trip-legacy",
      origen_lat: 40.4168,
      origen_lng: -3.7038,
      destino_lat: 39.8628,
      destino_lng: -4.0273,
      overview_polyline: null,
      Tramos: tramos,
    };

    const route = RouteGeometryService.resolvePolyline(trayecto, { format: "both" });

    assert.ok(route.encodedPolyline);
    assert.ok(route.encodedPolyline.length > 0);
    assert.deepEqual(route.keyPoints.origen, { lat: 40.4168, lng: -3.7038 });
    assert.deepEqual(route.keyPoints.destino, { lat: 39.8628, lng: -4.0273 });
    assert.equal(route.geometry.coordinates.length, 3);
  });

  it("debe aplicar fallbackCoords cuando overview_polyline y Tramos están vacíos", () => {
    const trayecto = {
      id: "test-trip-empty",
      origen_lat: 40.4168,
      origen_lng: -3.7038,
      destino_lat: 39.8628,
      destino_lng: -4.0273,
      overview_polyline: null,
      Tramos: [],
    };

    const route = RouteGeometryService.resolvePolyline(trayecto, { format: "both" });

    assert.ok(route.encodedPolyline);
    assert.deepEqual(route.keyPoints.origen, { lat: 40.4168, lng: -3.7038 });
    assert.deepEqual(route.keyPoints.destino, { lat: 39.8628, lng: -4.0273 });
    // Coordenadas origen -> destino directas
    assert.equal(route.geometry.coordinates.length, 2);
  });

  it("debe manejar trayectos nulos o undefined sin crashear", () => {
    const route = RouteGeometryService.resolvePolyline(null);
    assert.equal(route.encodedPolyline, null);
    assert.equal(route.geometry, null);
    assert.deepEqual(route.keyPoints, { origen: null, destino: null, paradas: [] });
  });

  it("debe decodificar y recodificar polilíneas de forma determinista", () => {
    const originalCoords = [
      [-3.7038, 40.4168],
      [-3.7080, 40.4200],
      [-3.7150, 40.4250],
      [-4.0273, 39.8628],
    ];

    const encoded = RouteGeometryService.encodePolyline(originalCoords);
    const decoded = RouteGeometryService.decodePolyline(encoded);
    const reEncoded = RouteGeometryService.encodePolyline(decoded);

    assert.equal(encoded, reEncoded);
    assert.equal(decoded.length, originalCoords.length);
  });
});
