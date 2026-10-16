import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { RouteGeometryService } from "../../app/services/routing/geometry-service.js";

describe("RouteGeometryService - Servicio de Geometría de Rutas", () => {
  describe("rdpSimplify - Simplificación Ramer-Douglas-Peucker", () => {
    it("debe preservar el primer y último punto", () => {
      const points = [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, 1],
        [4, 0]
      ];
      const simplified = RouteGeometryService.rdpSimplify(points, 0.5);
      
      assert.deepEqual(simplified[0], points[0]);
      assert.deepEqual(simplified[simplified.length - 1], points[points.length - 1]);
    });

    it("debe reducir puntos en línea recta", () => {
      const points = [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0]
      ];
      const simplified = RouteGeometryService.rdpSimplify(points, 0.5);
      
      assert.ok(simplified.length < points.length);
      assert.deepEqual(simplified[0], [0, 0]);
      assert.deepEqual(simplified[simplified.length - 1], [4, 0]);
    });

    it("debe mantener la forma en curvas significativas", () => {
      const points = [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, -1],
        [4, 0]
      ];
      const simplified = RouteGeometryService.rdpSimplify(points, 0.3);
      
      assert.ok(simplified.length >= 3);
      assert.deepEqual(simplified[0], [0, 0]);
      assert.deepEqual(simplified[simplified.length - 1], [4, 0]);
    });

    it("debe manejar arrays vacíos o de 1-2 puntos", () => {
      assert.deepEqual(RouteGeometryService.rdpSimplify([], 0.5), []);
      assert.deepEqual(RouteGeometryService.rdpSimplify([[0, 0]], 0.5), [[0, 0]]);
      assert.deepEqual(RouteGeometryService.rdpSimplify([[0, 0], [1, 1]], 0.5), [[0, 0], [1, 1]]);
    });
  });

  describe("encodePolyline - Codificación de Polilínea de Google", () => {
    it("debe codificar coordenadas básicas", () => {
      const coords = [[-3.7038, 40.4168], [-4.0273, 39.8628]];
      const encoded = RouteGeometryService.encodePolyline(coords);
      
      assert.ok(typeof encoded === "string");
      assert.ok(encoded.length > 0);
    });

    it("debe ser determinista", () => {
      const coords = [[-3.7038, 40.4168], [-4.0273, 39.8628]];
      const encoded1 = RouteGeometryService.encodePolyline(coords);
      const encoded2 = RouteGeometryService.encodePolyline(coords);
      
      assert.equal(encoded1, encoded2);
    });

    it("debe manejar arrays vacíos", () => {
      const encoded = RouteGeometryService.encodePolyline([]);
      assert.equal(encoded, "");
    });

    it("debe manejar un solo punto", () => {
      const encoded = RouteGeometryService.encodePolyline([[-3.7038, 40.4168]]);
      assert.ok(typeof encoded === "string");
    });
  });

  describe("decodePolyline - Decodificación de Polilínea de Google", () => {
    it("debe decodificar polilínea y recuperar coordenadas [lng, lat]", () => {
      const original = [[-3.7038, 40.4168], [-4.0273, 39.8628]];
      const encoded = RouteGeometryService.encodePolyline(original);
      const decoded = RouteGeometryService.decodePolyline(encoded);

      assert.equal(decoded.length, 2);
      assert.ok(Math.abs(decoded[0][0] - original[0][0]) < 0.0001);
      assert.ok(Math.abs(decoded[0][1] - original[0][1]) < 0.0001);
      assert.ok(Math.abs(decoded[1][0] - original[1][0]) < 0.0001);
      assert.ok(Math.abs(decoded[1][1] - original[1][1]) < 0.0001);
    });

    it("debe manejar string vacío o nulo", () => {
      assert.deepEqual(RouteGeometryService.decodePolyline(""), []);
      assert.deepEqual(RouteGeometryService.decodePolyline(null), []);
    });
  });

  describe("simplifyCoordinates - Simplificación por Zoom", () => {
    it("debe simplificar más en zoom bajo", () => {
      const coords = [];
      for (let i = 0; i < 100; i++) {
        coords.push([i * 0.01, Math.sin(i * 0.1) * 0.01]);
      }
      
      const simplifiedLow = RouteGeometryService.simplifyCoordinates(coords, 8);
      const simplifiedHigh = RouteGeometryService.simplifyCoordinates(coords, 15);
      
      assert.ok(simplifiedLow.length < simplifiedHigh.length);
    });

    it("debe preservar primer y último punto", () => {
      const coords = [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]];
      const simplified = RouteGeometryService.simplifyCoordinates(coords, 12);
      
      assert.deepEqual(simplified[0], coords[0]);
      assert.deepEqual(simplified[simplified.length - 1], coords[coords.length - 1]);
    });

    it("no debe alterar arrays pequeños", () => {
      const coords = [[0, 0], [1, 1]];
      const simplified = RouteGeometryService.simplifyCoordinates(coords, 12);
      
      assert.deepEqual(simplified, coords);
    });
  });

  describe("encodePolyline - Codificación de Polilínea", () => {
    it("debe codificar coordenadas válidas", () => {
      const coords = [[-3.7038, 40.4168], [-4.0273, 39.8628]];
      const encoded = RouteGeometryService.encodePolyline(coords);
      
      assert.ok(typeof encoded === "string");
      assert.ok(encoded.length > 0);
    });

    it("debe ser determinista", () => {
      const coords = [[-3.7038, 40.4168], [-4.0273, 39.8628]];
      const encoded1 = RouteGeometryService.encodePolyline(coords);
      const encoded2 = RouteGeometryService.encodePolyline(coords);
      
      assert.equal(encoded1, encoded2);
    });
  });

  describe("extractKeyPoints - Extracción de Puntos Clave", () => {
    it("debe extraer origen, destino y paradas", () => {
      const tramos = [
        { lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 },
        { lat: 40.3083, lng: -3.7327, address: "Getafe", step_order: 1 },
        { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 2 },
      ];
      
      const keyPoints = RouteGeometryService.extractKeyPoints(tramos);
      
      assert.ok(keyPoints.origen);
      assert.equal(keyPoints.origen.lat, 40.4168);
      assert.equal(keyPoints.origen.lng, -3.7038);
      
      assert.ok(keyPoints.destino);
      assert.equal(keyPoints.destino.lat, 39.8628);
      assert.equal(keyPoints.destino.lng, -4.0273);
      
      assert.ok(keyPoints.paradas.length === 1);
      assert.equal(keyPoints.paradas[0].lat, 40.3083);
    });

    it("debe manejar tramos vacíos", () => {
      const keyPoints = RouteGeometryService.extractKeyPoints([]);
      
      assert.equal(keyPoints.origen, null);
      assert.equal(keyPoints.destino, null);
      assert.deepEqual(keyPoints.paradas, []);
    });

    it("debe manejar un solo punto", () => {
      const tramos = [{ lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 }];
      const keyPoints = RouteGeometryService.extractKeyPoints(tramos);
      
      assert.equal(keyPoints.origen.lat, 40.4168);
      assert.equal(keyPoints.destino.lat, 40.4168);
      assert.deepEqual(keyPoints.paradas, []);
    });
  });

  describe("formatRoute - Formateo Completo de Rutas", () => {
    const tramos = [
      { lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 },
      { lat: 40.3083, lng: -3.7327, address: "Getafe", step_order: 1 },
      { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 2 },
    ];

    it("debe formatear en formato geojson por defecto", () => {
      const result = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "simplified", format: "geojson" });
      
      assert.ok(result.geometry);
      assert.equal(result.geometry.type, "LineString");
      assert.ok(result.geometry.coordinates.length >= 2);
      assert.ok(result.keyPoints.origen);
      assert.ok(result.keyPoints.destino);
    });

    it("debe formatear en formato encoded", () => {
      const result = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "simplified", format: "encoded" });
      
      assert.ok(result.encodedPolyline);
      assert.ok(typeof result.encodedPolyline === "string");
    });

    it("debe formatear en formato both", () => {
      const result = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "simplified", format: "both" });
      
      assert.ok(result.geometry);
      assert.ok(result.encodedPolyline);
    });

    it("debe formatear en formato bounds", () => {
      const result = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "bounds", format: "bounds" });
      
      assert.equal(result.geometry, null);
      assert.equal(result.encodedPolyline, null);
      assert.ok(result.keyPoints);
    });

    it("debe respetar precision full", () => {
      const full = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "full", format: "geojson" });
      const simplified = RouteGeometryService.formatRoute(tramos, { zoom: 12, precision: "simplified", format: "geojson" });
      
      assert.ok(full.geometry.coordinates.length >= simplified.geometry.coordinates.length);
    });

    it("debe manejar tramos vacíos", () => {
      const result = RouteGeometryService.formatRoute([], { zoom: 12 });
      
      assert.equal(result.geometry, null);
      assert.equal(result.encodedPolyline, null);
      assert.equal(result.keyPoints.origen, null);
      assert.equal(result.keyPoints.destino, null);
    });

    it("debe manejar un solo punto", () => {
      const result = RouteGeometryService.formatRoute([{ lat: 40.4168, lng: -3.7038, step_order: 0 }], { zoom: 12 });
      
      assert.equal(result.geometry, null);
      assert.ok(result.keyPoints.origen);
      assert.ok(result.keyPoints.destino);
    });

    it("debe respetar el parámetro zoom para simplificación", () => {
      const tramos = [];
      for (let i = 0; i < 20; i++) {
        tramos.push({
          lat: 40 + i * 0.01 + Math.sin(i * 0.5) * 0.005,
          lng: -3.7 + i * 0.01,
          step_order: i,
        });
      }

      const lowZoom = RouteGeometryService.formatRoute(tramos, { zoom: 8, precision: "simplified", format: "geojson" });
      const highZoom = RouteGeometryService.formatRoute(tramos, { zoom: 16, precision: "simplified", format: "geojson" });

      assert.ok(lowZoom.geometry.coordinates.length < highZoom.geometry.coordinates.length);
    });
  });

  describe("formatRoute - Opciones de Formato Avanzadas", () => {
    const tramos = [
      { lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 },
      { lat: 40.3083, lng: -3.7327, address: "Getafe", step_order: 1 },
      { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 2 },
    ];

    it("debe generar encodedPolyline correcta", () => {
      const result = RouteGeometryService.formatRoute(tramos, { format: "encoded" });
      
      assert.ok(result.encodedPolyline);
      assert.ok(typeof result.encodedPolyline === "string");
      assert.ok(result.encodedPolyline.length > 0);
    });

    it("debe preservar primer y último punto en encoded", () => {
      const result = RouteGeometryService.formatRoute(tramos, { format: "encoded" });
      
      // Decodificar y verificar que el primer y último punto coinciden
      assert.ok(result.encodedPolyline);
    });

    it("debe generar puntos clave correctos", () => {
      const result = RouteGeometryService.formatRoute(tramos);
      
      assert.ok(result.keyPoints.origen);
      assert.ok(result.keyPoints.destino);
      assert.equal(result.keyPoints.origen.lat, 40.4168);
      assert.equal(result.keyPoints.origen.lng, -3.7038);
      assert.equal(result.keyPoints.destino.lat, 39.8628);
      assert.equal(result.keyPoints.destino.lng, -4.0273);
    });
  });

  describe("perpendicularDistance - Distancia Perpendicular", () => {
    it("debe calcular distancia a segmento horizontal", () => {
      const point = [1, 1];
      const start = [0, 0];
      const end = [2, 0];
      
      const dist = RouteGeometryService.perpendicularDistance(point, start, end);
      
      // Distancia perpendicular a eje X = 1
      assert.ok(Math.abs(dist - 1) < 0.001);
    });

    it("debe calcular distancia a segmento vertical", () => {
      const point = [1, 1];
      const start = [0, 0];
      const end = [0, 2];
      
      const dist = RouteGeometryService.perpendicularDistance(point, start, end);
      
      assert.ok(Math.abs(dist - 1) < 0.001);
    });

    it("debe calcular distancia a segmento diagonal", () => {
      const point = [1, 0];
      const start = [0, 0];
      const end = [1, 1];
      
      const dist = RouteGeometryService.perpendicularDistance(point, start, end);
      
      // Distancia perpendicular a la diagonal = 1/√2 ≈ 0.707
      assert.ok(Math.abs(dist - 0.7071) < 0.01);
    });

    it("debe devolver 0 para segmento de longitud cero", () => {
      const dist = RouteGeometryService.perpendicularDistance([1, 1], [0, 0], [0, 0]);
      assert.equal(dist, 0);
    });
  });

  describe("getEpsilonByZoom - Tolerancia por Zoom", () => {
    it("debe devolver epsilon correcto para zoom bajo", () => {
      const epsilon = RouteGeometryService.getEpsilonByZoom(8);
      assert.equal(epsilon, 0.002);
    });

    it("debe devolver epsilon correcto para zoom medio", () => {
      const epsilon = RouteGeometryService.getEpsilonByZoom(12);
      assert.equal(epsilon, 0.0005);
    });

    it("debe devolver epsilon correcto para zoom alto", () => {
      const epsilon = RouteGeometryService.getEpsilonByZoom(16);
      assert.equal(epsilon, 0.00005);
    });

    it("debe devolver epsilon mínimo para zoom muy alto", () => {
      const epsilon = RouteGeometryService.getEpsilonByZoom(20);
      assert.equal(epsilon, 0.00005);
    });
  });
});