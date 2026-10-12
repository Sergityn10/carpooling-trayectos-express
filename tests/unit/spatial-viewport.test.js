import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { SpatialIndex, GeoMath } from "../../app/services/routing/routing-engine.js";

describe("SpatialIndex y Geometría - Búsqueda por Viewport y Simplificación", () => {
  let index;

  beforeEach(() => {
    index = new SpatialIndex();
  });

  describe("R-Tree BBox Search (searchBBox)", () => {
    const madridCentro = [
      { lat: 40.4168, lng: -3.7038, address: "Madrid Centro", step_order: 0 },
      { lat: 40.4100, lng: -3.6950, address: "Atocha", step_order: 1 },
      { lat: 40.4000, lng: -3.6900, address: "Puente de Vallecas", step_order: 2 },
    ];

    const toledoCentro = [
      { lat: 39.8628, lng: -4.0273, address: "Toledo Centro", step_order: 0 },
      { lat: 39.8500, lng: -4.0200, address: "Santa María de Benquerencia", step_order: 1 },
    ];

    const barcelonaCentro = [
      { lat: 41.3851, lng: 2.1734, address: "Barcelona Centro", step_order: 0 },
      { lat: 41.3900, lng: 2.1800, address: "Eixample", step_order: 1 },
    ];

    it("debe encontrar trayectos dentro del BBox", () => {
      index.addTrayecto("trip-madrid", madridCentro);
      index.addTrayecto("trip-toledo", toledoCentro);

      const bbox = { minLat: 40.39, maxLat: 40.43, minLng: -3.72, maxLng: -3.68 };
      const results = index.searchBBox(bbox);

      assert.ok(results.length > 0, "Debe encontrar segmentos en el BBox");
      const ids = [...new Set(results.map(r => r.trayectoId))];
      assert.ok(ids.includes("trip-madrid"), "Debe incluir trayecto de Madrid");
      assert.ok(!ids.includes("trip-toledo"), "No debe incluir trayecto de Toledo");
    });

    it("debe devolver array vacío para BBox sin trayectos", () => {
      index.addTrayecto("trip-madrid", madridCentro);

      const bbox = { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }; // Océano
      const results = index.searchBBox(bbox);

      assert.equal(results.length, 0, "No debe encontrar trayectos en zona vacía");
    });

    it("debe encontrar trayectos que cruzan la frontera del BBox", () => {
      // Trayecto que empieza fuera y entra en el BBox
      const cruzaBBox = [
        { lat: 40.45, lng: -3.75, address: "Fuera Norte", step_order: 0 },
        { lat: 40.41, lng: -3.70, address: "Dentro BBox", step_order: 1 },
        { lat: 40.38, lng: -3.68, address: "Fuera Sur", step_order: 2 },
      ];
      index.addTrayecto("trip-cruza", cruzaBBox);

      const bbox = { minLat: 40.39, maxLat: 40.43, minLng: -3.72, maxLng: -3.68 };
      const results = index.searchBBox(bbox);

      assert.ok(results.length > 0, "Debe encontrar segmentos que intersectan el BBox");
      assert.ok(results.some(r => r.trayectoId === "trip-cruza"));
    });

    it("debe aislar trayectos por ciudad en consultas separadas", () => {
      index.addTrayecto("trip-madrid", madridCentro);
      index.addTrayecto("trip-barcelona", barcelonaCentro);

      // Consultar Madrid
      const bboxMadrid = { minLat: 40.39, maxLat: 40.43, minLng: -3.72, maxLng: -3.68 };
      const resultsMadrid = index.searchBBox(bboxMadrid);
      const idsMadrid = [...new Set(resultsMadrid.map(r => r.trayectoId))];
      assert.ok(idsMadrid.includes("trip-madrid"));
      assert.ok(!idsMadrid.includes("trip-barcelona"));

      // Consultar Barcelona
      const bboxBCN = { minLat: 41.37, maxLat: 41.41, minLng: 2.15, maxLng: 2.20 };
      const resultsBCN = index.searchBBox(bboxBCN);
      const idsBCN = [...new Set(resultsBCN.map(r => r.trayectoId))];
      assert.ok(idsBCN.includes("trip-barcelona"));
      assert.ok(!idsBCN.includes("trip-madrid"));
    });
  });

  describe("GeoMath - Proyección y Distancias", () => {
    const madrid = { lat: 40.4168, lng: -3.7038 };
    const toledo = { lat: 39.8628, lng: -4.0273 };

    it("debe calcular distancia Haversine correcta", () => {
      const dist = GeoMath.haversineKm(madrid.lat, madrid.lng, toledo.lat, toledo.lng);
      assert.ok(dist > 65 && dist < 75, `Distancia Madrid-Toledo ~70km, obtuvo ${dist.toFixed(1)}km`);
    });

    it("debe proyectar punto sobre segmento correctamente", () => {
      // Pinto está en la zona general de la ruta Madrid-Toledo
      const pinto = { lat: 40.2417, lng: -3.6997 };
      const proj = GeoMath.projectPointOnSegment(pinto, madrid, toledo);

      // La proyección ortogonal está en el segmento (t entre 0 y 1)
      assert.ok(proj.t > 0 && proj.t < 1, `Parámetro t dentro del segmento: ${proj.t.toFixed(2)}`);
      // La distancia es razonable para una ciudad cercana a la ruta
      assert.ok(proj.distanceKm < 15, `Distancia perpendicular < 15km, obtuvo ${proj.distanceKm.toFixed(2)}km`);
    });
  });

  describe("Simplificación de Coordenadas (Ramer-Douglas-Peucker)", () => {
    function simplifyCoordinates(coords, zoom) {
      const epsilon = zoom <= 10 ? 0.002 : zoom <= 12 ? 0.0005 : 0.00015;
      const simplified = [coords[0]];
      for (let i = 1; i < coords.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = coords[i];
        const next = coords[i + 1];
        const dist = perpendicularDistance(curr, prev, next);
        if (dist > epsilon) simplified.push(curr);
      }
      simplified.push(coords[coords.length - 1]);
      return simplified;
    }

    function perpendicularDistance(point, lineStart, lineEnd) {
      const [x0, y0] = point;
      const [x1, y1] = lineStart;
      const [x2, y2] = lineEnd;
      const num = Math.abs((x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y1));
      const den = Math.hypot(x2 - x1, y2 - y1);
      return den === 0 ? 0 : num / den;
    }

    const rutaLarga = [
      [-3.7038, 40.4168],
      [-3.7000, 40.4100],
      [-3.6950, 40.4050],
      [-3.6900, 40.4000],
      [-3.6850, 40.3950],
      [-3.6800, 40.3900],
      [-3.6750, 40.3850],
      [-3.6700, 40.3800],
    ];

    it("debe preservar siempre el primer y último punto", () => {
      const simplified = simplifyCoordinates(rutaLarga, 12);
      assert.deepEqual(simplified[0], rutaLarga[0]);
      assert.deepEqual(simplified[simplified.length - 1], rutaLarga[rutaLarga.length - 1]);
    });

    it("debe reducir puntos en zoom bajo (zoom 8)", () => {
      const simplified = simplifyCoordinates(rutaLarga, 8);
      assert.ok(simplified.length < rutaLarga.length, `Zoom 8: ${simplified.length} < ${rutaLarga.length}`);
    });

    it("debe reducir menos puntos en zoom alto (zoom 15)", () => {
      const simplifiedLow = simplifyCoordinates(rutaLarga, 8);
      const simplifiedHigh = simplifyCoordinates(rutaLarga, 15);
      assert.ok(simplifiedHigh.length >= simplifiedLow.length, "Zoom alto preserva más detalle");
    });

    it("no debe alterar rutas con 2 o menos puntos", () => {
      const rutaCorta = [[-3.7038, 40.4168], [-3.6700, 40.3800]];
      const simplified = simplifyCoordinates(rutaCorta, 12);
      assert.deepEqual(simplified, rutaCorta);
    });
  });

  describe("Eliminación y Reconstrucción", () => {
    it("debe permitir eliminar un trayecto y que desaparezca de búsquedas", () => {
      index.addTrayecto("trip-1", [
        { lat: 40.4168, lng: -3.7038, step_order: 0 },
        { lat: 40.4000, lng: -3.6900, step_order: 1 },
      ]);

      let results = index.searchBBox({ minLat: 40.39, maxLat: 40.43, minLng: -3.72, maxLng: -3.68 });
      assert.ok(results.some(r => r.trayectoId === "trip-1"));

      index.removeTrayecto("trip-1");

      results = index.searchBBox({ minLat: 40.39, maxLat: 40.43, minLng: -3.72, maxLng: -3.68 });
      assert.ok(!results.some(r => r.trayectoId === "trip-1"), "Trayecto eliminado no debe aparecer");
    });
  });
});