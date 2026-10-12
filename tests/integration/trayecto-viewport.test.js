import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { PrismaClient } from "@prisma/client";
import express from "express";
import { TrayectosController } from "../../app/controllers/trayectos.js";
import { utilsAuthentication } from "../../app/utils/authentication.js";
import { globalSpatialIndex, RoutingEngine } from "../../app/services/routing/routing-engine.js";

const prisma = new PrismaClient();
let app;
let server;
let baseUrl;
let testTrayectoIds = [];

async function cleanupTestData() {
  await prisma.tramo.deleteMany({
    where: { id_trayecto: { in: testTrayectoIds } },
  });
  await prisma.trayecto.deleteMany({
    where: { id: { in: testTrayectoIds } },
  });
  testTrayectoIds = [];
}

function createTestApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(utilsAuthentication.tryAuthenticate);
  testApp.get("/api/trayecto/viewport", async (req, res) => {
    await TrayectosController.obtenerTrayectosEnViewport(req, res);
  });
  return testApp;
}

async function createTestTrayecto(data) {
  const tramos = data.tramos || [
    { lat: data.origen_lat, lng: data.origen_lng, address: data.origen, step_order: 0 },
    { lat: data.destino_lat, lng: data.destino_lng, address: data.destino, step_order: 1 },
  ];

  const trayecto = await prisma.trayecto.create({
    data: {
      id: data.id || crypto.randomUUID(),
      origen: data.origen,
      destino: data.destino,
      hora: data.hora || new Date(Date.now() + 3600000),
      plazas: data.plazas || 4,
      disponible: data.disponible || 4,
      precio: data.precio || 10.0,
      conductor: data.conductor || "test-driver-1",
      origen_lat: data.origen_lat,
      origen_lng: data.origen_lng,
      destino_lat: data.destino_lat,
      destino_lng: data.destino_lng,
      status: data.status || "programado",
      Tramos: {
        create: tramos.map(t => ({
          lat: t.lat,
          lng: t.lng,
          address: t.address,
          step_order: t.step_order,
        })),
      },
    },
    include: { Tramos: true },
  });

  testTrayectoIds.push(trayecto.id);
  globalSpatialIndex.addTrayecto(trayecto.id, trayecto.Tramos, {
    fecha: trayecto.hora.toISOString().split("T")[0],
    hora: trayecto.hora,
    plazas: trayecto.plazas,
    disponible: trayecto.disponible,
    precio: trayecto.precio,
    conductor: trayecto.conductor,
  });

  return trayecto;
}

describe("Integration - GET /api/trayecto/viewport", () => {
  before(async () => {
    app = createTestApp();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    await RoutingEngine.initialize(prisma);
  });

  after(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    server.close();
  });

  describe("Filtrado por Estados de Trayecto", () => {
    it("debe incluir trayectos con status 'programado'", async () => {
      await createTestTrayecto({
        id: "test-programado",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        status: "programado",
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10`);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.ok(json.data.some(t => t.id === "test-programado"), "Debe incluir trayecto programado");
    });

    it("debe incluir trayectos con status 'en curso'", async () => {
      await createTestTrayecto({
        id: "test-encurso",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        status: "en curso",
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10`);
      const json = await res.json();

      assert.ok(json.data.some(t => t.id === "test-encurso"), "Debe incluir trayecto en curso");
    });

    it("NO debe incluir trayectos con status 'finalizado'", async () => {
      await createTestTrayecto({
        id: "test-finalizado",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        status: "finalizado",
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10`);
      const json = await res.json();

      assert.ok(!json.data.some(t => t.id === "test-finalizado"), "No debe incluir trayecto finalizado");
    });
  });

  describe("Filtrado por Plazas Disponibles", () => {
    it("debe excluir trayectos con plazas insuficientes", async () => {
      await createTestTrayecto({
        id: "test-1plaza",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        disponible: 1,
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10&plazas=2`);
      const json = await res.json();

      assert.ok(!json.data.some(t => t.id === "test-1plaza"), "No debe incluir trayecto con solo 1 plaza cuando se piden 2");
    });

    it("debe incluir trayectos con plazas suficientes", async () => {
      await createTestTrayecto({
        id: "test-4plazas",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        disponible: 4,
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10&plazas=2`);
      const json = await res.json();

      assert.ok(json.data.some(t => t.id === "test-4plazas"), "Debe incluir trayecto con 4 plazas cuando se piden 2");
    });
  });

  describe("Filtrado por Fecha", () => {
    it("debe filtrar trayectos por fecha exacta", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      await createTestTrayecto({
        id: "test-manana",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        hora: new Date(`${tomorrow}T10:00:00Z`),
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10&fecha=${tomorrow}`);
      const json = await res.json();

      assert.ok(json.data.some(t => t.id === "test-manana"), "Debe incluir trayecto de mañana");
    });

    it("NO debe incluir trayectos de otra fecha", async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      await createTestTrayecto({
        id: "test-ayer",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        hora: new Date(`${yesterday}T10:00:00Z`),
      });

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10&fecha=${tomorrow}`);
      const json = await res.json();

      assert.ok(!json.data.some(t => t.id === "test-ayer"), "No debe incluir trayecto de ayer");
    });
  });

  describe("Formato de Salida según Precision", () => {
    it("precision=bounds NO debe incluir geometry", async () => {
      await createTestTrayecto({
        id: "test-bounds",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=8&precision=bounds`);
      const json = await res.json();

      const trayecto = json.data.find(t => t.id === "test-bounds");
      assert.ok(trayecto, "Trayecto debe existir");
      assert.ok(!trayecto.geometry, "precision=bounds no debe incluir geometry");
      assert.ok(trayecto.puntosClave, "Debe incluir puntosClave");
    });

    it("precision=simplified DEBE incluir geometry LineString", async () => {
      await createTestTrayecto({
        id: "test-simplified",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=12&precision=simplified`);
      const json = await res.json();

      const trayecto = json.data.find(t => t.id === "test-simplified");
      assert.ok(trayecto, "Trayecto debe existir");
      assert.ok(trayecto.geometry, "Debe incluir geometry");
      assert.equal(trayecto.geometry.type, "LineString");
      assert.ok(Array.isArray(trayecto.geometry.coordinates));
      assert.ok(trayecto.geometry.coordinates.length >= 2);
    });

    it("precision=full DEBE incluir geometry con todos los tramos", async () => {
      await createTestTrayecto({
        id: "test-full",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
        tramos: [
          { lat: 40.4168, lng: -3.7038, address: "Madrid", step_order: 0 },
          { lat: 40.3500, lng: -3.7500, address: "Getafe", step_order: 1 },
          { lat: 40.2000, lng: -3.8500, address: "Illescas", step_order: 2 },
          { lat: 39.8628, lng: -4.0273, address: "Toledo", step_order: 3 },
        ],
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=15&precision=full`);
      const json = await res.json();

      const trayecto = json.data.find(t => t.id === "test-full");
      assert.ok(trayecto, "Trayecto debe existir");
      assert.ok(trayecto.geometry);
      assert.equal(trayecto.geometry.type, "LineString");
      assert.ok(trayecto.geometry.coordinates.length >= 4, "full debe incluir todos los tramos");
    });
  });

  describe("Respuesta en áreas sin trayectos", () => {
    it("debe retornar 200 con data vacía para zona sin trayectos", async () => {
      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=0&maxLat=1&minLng=0&maxLng=1&zoom=10`);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.status, "Success");
      assert.deepEqual(json.data, []);
      assert.equal(json.meta.totalMatches, 0);
    });
  });

  describe("Enriquecimiento de Conductor y Preferencias", () => {
    it("debe incluir driverPreferences en la respuesta", async () => {
      await createTestTrayecto({
        id: "test-prefs",
        origen: "Madrid",
        destino: "Toledo",
        origen_lat: 40.4168,
        origen_lng: -3.7038,
        destino_lat: 39.8628,
        destino_lng: -4.0273,
      });

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=12`);
      const json = await res.json();

      const trayecto = json.data.find(t => t.id === "test-prefs");
      assert.ok(trayecto, "Trayecto debe existir");
      assert.ok("driverPreferences" in trayecto, "Debe incluir driverPreferences");
    });
  });

  describe("Límite de Resultados", () => {
    it("debe respetar el parámetro limit", async () => {
      for (let i = 0; i < 5; i++) {
        await createTestTrayecto({
          id: `test-limit-${i}`,
          origen: `Madrid-${i}`,
          destino: `Toledo-${i}`,
          origen_lat: 40.4168 + i * 0.01,
          origen_lng: -3.7038,
          destino_lat: 39.8628 + i * 0.01,
          destino_lng: -4.0273,
        });
      }

      const res = await fetch(`${baseUrl}/api/trayecto/viewport?minLat=39.8&maxLat=40.5&minLng=-4.1&maxLng=-3.6&zoom=10&limit=3`);
      const json = await res.json();

      assert.ok(json.data.length <= 3, `Debe limitar a 3 resultados, obtuvo ${json.data.length}`);
    });
  });
});