import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { GeoMath, getBoundingBox } from "../../app/services/routing/geo-math.js";

describe("GeoMath - Utilidades Geométricas y Trigonométricas", () => {
  const madrid = { lat: 40.4168, lng: -3.7038 };
  const toledo = { lat: 39.8628, lng: -4.0273 };
  const barcelona = { lat: 41.3851, lng: 2.1734 };
  const sevilla = { lat: 37.3891, lng: -5.9845 };

  describe("Haversine Distance", () => {
    it("calcula distancia Madrid-Toledo ~70km", () => {
      const dist = GeoMath.haversineKm(madrid.lat, madrid.lng, toledo.lat, toledo.lng);
      assert.ok(dist > 65 && dist < 75, `Distancia ${dist.toFixed(1)}km, esperado ~70km`);
    });

    it("calcula distancia Madrid-Barcelona ~500km", () => {
      const dist = GeoMath.haversineKm(madrid.lat, madrid.lng, barcelona.lat, barcelona.lng);
      assert.ok(dist > 480 && dist < 520, `Distancia ${dist.toFixed(1)}km, esperado ~500km`);
    });

    it("distancia cero para mismo punto", () => {
      const dist = GeoMath.haversineKm(madrid.lat, madrid.lng, madrid.lat, madrid.lng);
      assert.equal(dist, 0);
    });

    it("distancia simétrica A->B = B->A", () => {
      const distAB = GeoMath.haversineKm(madrid.lat, madrid.lng, toledo.lat, toledo.lng);
      const distBA = GeoMath.haversineKm(toledo.lat, toledo.lng, madrid.lat, madrid.lng);
      assert.equal(distAB.toFixed(10), distBA.toFixed(10));
    });

    it("maneja polos (latitud 90/-90)", () => {
      const norte = { lat: 90, lng: 0 };
      const sur = { lat: -90, lng: 0 };
      const dist = GeoMath.haversineKm(norte.lat, norte.lng, sur.lat, sur.lng);
      // Distancia polo a polo = 20,015 km (media circunferencia)
      assert.ok(dist > 19900 && dist < 20100);
    });

    it("maneja antípodas (diferencia 180° longitud)", () => {
      const a = { lat: 40, lng: -10 };
      const b = { lat: -40, lng: 170 }; // Antípoda exacta
      const dist = GeoMath.haversineKm(a.lat, a.lng, b.lat, b.lng);
      // Radio Tierra * PI = 6371 * 3.14159 = 20015 km
      assert.ok(dist > 19900 && dist < 20100);
    });

    it("pequeñas distancias < 1km con precisión metros", () => {
      const a = { lat: 40.4168, lng: -3.7038 };
      const b = { lat: 40.4178, lng: -3.7038 }; // ~111m al norte
      const dist = GeoMath.haversineKm(a.lat, a.lng, b.lat, b.lng);
      assert.ok(dist > 0.1 && dist < 0.15, `Distancia ${dist * 1000}m, esperado ~111m`);
    });
  });

  describe("Proyección Ortogonal Punto-Segmento", () => {
    it("proyecta punto sobre segmento recto horizontal", () => {
      const start = { lat: 40.0, lng: -4.0 };
      const end = { lat: 40.0, lng: -3.0 };
      const point = { lat: 40.0, lng: -3.5 }; // Exactamente en el medio

      const proj = GeoMath.projectPointOnSegment(point, start, end);

      assert.ok(Math.abs(proj.projectedLat - 40.0) < 0.0001);
      assert.ok(Math.abs(proj.projectedLng - (-3.5)) < 0.0001);
      assert.ok(proj.distanceKm < 0.1);
      assert.ok(proj.t > 0.4 && proj.t < 0.6);
    });

    it("proyecta punto antes del inicio del segmento -> t clampado a 0", () => {
      const start = { lat: 40.0, lng: -4.0 };
      const end = { lat: 40.0, lng: -3.0 };
      const point = { lat: 40.0, lng: -4.5 }; // Antes del inicio

      const proj = GeoMath.projectPointOnSegment(point, start, end);

      // t se clampa a [0, 1]
      assert.equal(proj.t, 0);
      assert.ok(proj.distanceKm > 0);
    });

    it("proyecta punto después del final del segmento -> t clampado a 1", () => {
      const start = { lat: 40.0, lng: -4.0 };
      const end = { lat: 40.0, lng: -3.0 };
      const point = { lat: 40.0, lng: -2.5 }; // Después del final

      const proj = GeoMath.projectPointOnSegment(point, start, end);

      // t se clampa a [0, 1]
      assert.equal(proj.t, 1);
      assert.ok(proj.distanceKm > 0);
    });

    it("proyecta punto cercano a ruta Madrid-Toledo (Pinto)", () => {
      // Pinto está cerca de la autovía A-42 Madrid-Toledo
      const pinto = { lat: 40.2417, lng: -3.6997 };
      const proj = GeoMath.projectPointOnSegment(pinto, madrid, toledo);

      // La proyección debe caer dentro del segmento
      assert.ok(proj.t > 0 && proj.t < 1, `t = ${proj.t.toFixed(3)}`);
      // Distancia perpendicular razonable (< 15km para ciudad cercana a autovía)
      assert.ok(proj.distanceKm < 15, `Distancia ${proj.distanceKm.toFixed(1)}km`);
    });

    it("segmento de longitud cero (punto a punto)", () => {
      const point = { lat: 40.4168, lng: -3.7038 };
      const proj = GeoMath.projectPointOnSegment(point, madrid, madrid);

      assert.ok(proj.t === 0 || proj.t === 1);
      assert.ok(proj.distanceKm < 0.01);
    });
  });

  describe("Bounding Box desde Radio", () => {
    it("getBoundingBox calcula caja correcta para radio en km", () => {
      const center = { lat: 40.4168, lng: -3.7038 };
      const radiusKm = 10;

      const bbox = getBoundingBox(center.lat, center.lng, radiusKm);

      // 1 grado latitud ≈ 111km
      const expectedLatDelta = radiusKm / 111;
      // 1 grado longitud ≈ 111km * cos(lat)
      const expectedLngDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));

      assert.ok(Math.abs(bbox.maxLat - (center.lat + expectedLatDelta)) < 0.001);
      assert.ok(Math.abs(bbox.minLat - (center.lat - expectedLatDelta)) < 0.001);
      assert.ok(Math.abs(bbox.maxLng - (center.lng + expectedLngDelta)) < 0.001);
      assert.ok(Math.abs(bbox.minLng - (center.lng - expectedLngDelta)) < 0.001);
    });

    it("bbox en el ecuador tiene misma lat/lng delta", () => {
      const center = { lat: 0, lng: 0 };
      const radiusKm = 111; // 1 grado

      const bbox = getBoundingBox(center.lat, center.lng, radiusKm);

      assert.ok(Math.abs(bbox.maxLat - 1) < 0.01);
      assert.ok(Math.abs(bbox.maxLng - 1) < 0.01);
    });

    it("bbox en polos tiene delta longitud muy grande", () => {
      const center = { lat: 89, lng: 0 };
      const radiusKm = 100;

      const bbox = getBoundingBox(center.lat, center.lng, radiusKm);

      // En polos, 1 grado longitud es muy pequeño
      // La caja debe cubrir todo el círculo
      assert.ok(bbox.maxLng - bbox.minLng > 10); // Gran amplitud longitudinal
    });
  });

  describe("Utilidades Adicionales", () => {
    it("estimateDurationSec calcula duración basada en distancia y velocidad", () => {
      const duration65 = GeoMath.estimateDurationSec(65, 65); // 65km a 65km/h = 1h
      assert.equal(duration65, 3600);

      const duration130 = GeoMath.estimateDurationSec(130, 65); // 130km a 65km/h = 2h
      assert.equal(duration130, 7200);

      const duration0 = GeoMath.estimateDurationSec(0, 65);
      assert.equal(duration0, 0);
    });

    it("calculatePolylineDistanceKm suma distancias de polilínea", () => {
      const points = [
        { lat: 40.4168, lng: -3.7038 },
        { lat: 40.3083, lng: -3.7327 },
        { lat: 39.8628, lng: -4.0273 },
      ];

      const dist = GeoMath.calculatePolylineDistanceKm(points);
      // Madrid -> Getafe -> Toledo
      assert.ok(dist > 65 && dist < 75);
    });
  });
});