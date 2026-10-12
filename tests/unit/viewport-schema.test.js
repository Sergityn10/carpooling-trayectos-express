import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { viewportQuerySchema } from "../../app/schemas/trayecto.js";

describe("viewportQuerySchema - Validación de parámetros de viewport", () => {
  const validViewport = {
    minLat: 40.4,
    maxLat: 40.45,
    minLng: -3.72,
    maxLng: -3.65,
  };

  describe("Casos válidos", () => {
    it("debe aceptar viewport con coordenadas numéricas válidas", () => {
      const result = viewportQuerySchema.safeParse(validViewport);
      assert.ok(result.success, "Viewport válido debe pasar validación");
    });

    it("debe aceptar viewport con coordenadas como strings (coerción)", () => {
      const result = viewportQuerySchema.safeParse({
        minLat: "40.4",
        maxLat: "40.45",
        minLng: "-3.72",
        maxLng: "-3.65",
      });
      assert.ok(result.success, "Strings numéricos deben coercionarse correctamente");
    });

    it("debe asignar valores por defecto correctamente", () => {
      const result = viewportQuerySchema.safeParse(validViewport);
      assert.ok(result.success);
      assert.equal(result.data.zoom, 12);
      assert.equal(result.data.precision, "simplified");
      assert.equal(result.data.limit, 50);
      assert.equal(result.data.plazas, 1);
    });

    it("debe aceptar filtros opcionales válidos", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        fecha: "2026-10-10",
        plazas: 2,
        precision: "full",
        limit: 100,
        zoom: 15,
      });
      assert.ok(result.success);
      assert.equal(result.data.fecha, "2026-10-10");
      assert.equal(result.data.plazas, 2);
      assert.equal(result.data.precision, "full");
      assert.equal(result.data.limit, 100);
      assert.equal(result.data.zoom, 15);
    });

    it("debe aceptar precision=bounds", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        precision: "bounds",
      });
      assert.ok(result.success);
      assert.equal(result.data.precision, "bounds");
    });
  });

  describe("Casos de rechazo - Parámetros obligatorios", () => {
    it("debe rechazar si falta minLat", () => {
      const { minLat, ...rest } = validViewport;
      const result = viewportQuerySchema.safeParse(rest);
      assert.ok(!result.success);
    });

    it("debe rechazar si falta maxLat", () => {
      const { maxLat, ...rest } = validViewport;
      const result = viewportQuerySchema.safeParse(rest);
      assert.ok(!result.success);
    });

    it("debe rechazar si falta minLng", () => {
      const { minLng, ...rest } = validViewport;
      const result = viewportQuerySchema.safeParse(rest);
      assert.ok(!result.success);
    });

    it("debe rechazar si falta maxLng", () => {
      const { maxLng, ...rest } = validViewport;
      const result = viewportQuerySchema.safeParse(rest);
      assert.ok(!result.success);
    });
  });

  describe("Casos de rechazo - Rangos de coordenadas", () => {
    it("debe rechazar latitud > 90", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        maxLat: 91,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar latitud < -90", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        minLat: -91,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar longitud > 180", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        maxLng: 181,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar longitud < -180", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        minLng: -181,
      });
      assert.ok(!result.success);
    });
  });

  describe("Casos de rechazo - Inconsistencia geométrica", () => {
    it("debe rechazar si minLat > maxLat", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        minLat: 40.5,
        maxLat: 40.4,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar si minLng > maxLng", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        minLng: -3.6,
        maxLng: -3.7,
      });
      assert.ok(!result.success);
    });
  });

  describe("Casos de rechazo - Parámetros opcionales inválidos", () => {
    it("debe rechazar precision inválida", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        precision: "invalid",
      });
      assert.ok(!result.success);
    });

    it("debe rechazar limit < 1", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        limit: 0,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar limit > 100", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        limit: 101,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar plazas < 1", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        plazas: 0,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar plazas > 8", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        plazas: 9,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar fecha con formato inválido", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        fecha: "10-10-2026",
      });
      assert.ok(!result.success);
    });

    it("debe rechazar zoom < 1", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        zoom: 0,
      });
      assert.ok(!result.success);
    });

    it("debe rechazar zoom > 22", () => {
      const result = viewportQuerySchema.safeParse({
        ...validViewport,
        zoom: 23,
      });
      assert.ok(!result.success);
    });
  });
});