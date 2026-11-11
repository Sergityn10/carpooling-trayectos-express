import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import http from "node:http";
import * as NotificationEvents from "../../app/constants/notificationEvents.js";
import { AlertasMatcherService } from "../../app/services/alertas/alertasMatcherService.js";
import { trayectoEmitter, TRAYECTO_DOMAIN_EVENTS } from "../../app/events/trayectoEmitter.js";
import { handleNuevoTrayectoCreado } from "../../app/listeners/alertasListener.js";
import { NotificationsAPI } from "../../app/utils/notifications-api.js";

describe("Alertas Matcher, Observer, RabbitMQ & HTTP Fallback", () => {
  describe("Constantes Oficiales de Eventos (notificationEvents.js)", () => {
    it("debe exportar exactamente el exchange, routing keys y tipos batch esperados", () => {
      assert.equal(NotificationEvents.EXCHANGE, "carpooling_events");
      assert.equal(NotificationEvents.EXCHANGE_TYPE, "topic");
      assert.equal(NotificationEvents.EXCHANGE_DURABLE, true);
      assert.equal(NotificationEvents.MAX_BATCH_RECIPIENTS, 5000);
      assert.deepStrictEqual(NotificationEvents.CHANNELS, ["push", "email"]);

      assert.equal(NotificationEvents.TRIP_ALERT_MATCHED, "trip.alert.matched");
      assert.equal(NotificationEvents.TRIP_CONFIRMED, "trip.confirmed");
      assert.equal(NotificationEvents.TRIP_BOOKED, "trip.booked");
      assert.equal(NotificationEvents.TRIP_CANCELLED, "trip.cancelled");
      assert.equal(NotificationEvents.TRIP_STARTED, "trip.started");
      assert.equal(NotificationEvents.TRIP_COMPLETED, "trip.completed");
      assert.equal(
        NotificationEvents.TRIP_BOOKING_REQUESTED,
        "trip.booking.requested",
      );

      assert.deepStrictEqual(NotificationEvents.NOTIFICATION_TYPES, {
        TRIP_ALERT_MATCHED: "trip_alert_matched",
        TRIP_CONFIRMATION: "trip_confirmation",
        TRIP_BOOKED: "trip_booked",
        TRIP_CANCELLED: "trip_cancelled",
        TRIP_STARTED: "trip_started",
        TRIP_COMPLETED: "trip_completed",
        BOOKING_REQUEST: "booking_request",
      });
    });
  });

  describe("Exclusión del conductor y deduplicación de userIds", () => {
    it("excluye al conductor tanto en la query Prisma como defensivamente", async () => {
      let capturedQueryArgs = null;
      const mockPrisma = {
        alertaTrayecto: {
          findMany: async (args) => {
            capturedQueryArgs = args;
            return [
              { usuarioId: "driver-1" },
              { usuarioId: "usr-101" },
              { usuarioId: "usr-204" },
              { usuarioId: "usr-101" },
            ];
          },
        },
      };

      const publishedCalls = [];
      const result = await AlertasMatcherService.processTripAlertMatches(
        {
          id: "482",
          origen: "Madrid",
          destino: "Valencia",
          fecha: "2026-11-15",
          hora: "08:30",
          precio: 18,
          disponible: 3,
          driverName: "Carlos",
          organizadorId: "driver-1",
          eventoId: "evt-99",
        },
        {
          prismaClient: mockPrisma,
          publishRabbitMQ: async (routingKey, data, source) => {
            publishedCalls.push({ routingKey, data, source });
            return true;
          },
          sendBatchHttp: async () => {
            throw new Error("No debe llamarse HTTP fallback si RabbitMQ tuvo éxito");
          },
        },
      );

      assert.equal(capturedQueryArgs.where.activa, true);
      assert.deepStrictEqual(capturedQueryArgs.where.usuarioId, { not: "driver-1" });
      assert.deepStrictEqual(capturedQueryArgs.distinct, ["usuarioId"]);
      assert.deepStrictEqual(capturedQueryArgs.select, { usuarioId: true });
      assert.deepStrictEqual(capturedQueryArgs.where.OR, [
        { tipo: "EVENTO", eventoId: "evt-99" },
        { tipo: "DESTINO", destino: "Valencia" },
      ]);

      assert.deepStrictEqual(result.userIds, ["usr-101", "usr-204"]);
      assert.equal(publishedCalls.length, 1);
      assert.deepStrictEqual(publishedCalls[0].data.userIds, ["usr-101", "usr-204"]);
    });

    it("no publica nada ni en RabbitMQ ni en HTTP si no hay coincidencias o solo coincide el conductor", async () => {
      const mockPrisma = {
        alertaTrayecto: {
          findMany: async () => [{ usuarioId: "driver-1" }],
        },
      };

      let rabbitCalled = false;
      let httpCalled = false;

      const result = await AlertasMatcherService.processTripAlertMatches(
        {
          id: "482",
          origen: "Madrid",
          destino: "Valencia",
          fecha: "2026-11-15",
          hora: "08:30",
          precio: 18,
          organizadorId: "driver-1",
        },
        {
          prismaClient: mockPrisma,
          publishRabbitMQ: async () => {
            rabbitCalled = true;
            return true;
          },
          sendBatchHttp: async () => {
            httpCalled = true;
          },
        },
      );

      assert.equal(result.matchedCount, 0);
      assert.equal(result.chunksPublished, 0);
      assert.equal(rabbitCalled, false);
      assert.equal(httpCalled, false);
    });
  });

  describe("Formato exacto del payload trip.alert.matched y Chunking", () => {
    it("genera el formato exacto del contrato RabbitMQ para trip.alert.matched", async () => {
      const mockPrisma = {
        alertaTrayecto: {
          findMany: async () => [
            { usuarioId: "usr-101" },
            { usuarioId: "usr-204" },
            { usuarioId: "usr-389" },
          ],
        },
      };

      const published = [];
      await AlertasMatcherService.processTripAlertMatches(
        {
          id: "482",
          origen: "Madrid",
          destino: "Valencia",
          fecha: "2026-11-15",
          hora: "08:30",
          precio: 18,
          plazas: 3,
          disponible: 3,
          conductor: "Carlos",
          conductor_id: "driver-42",
          organizadorId: "driver-42",
        },
        {
          prismaClient: mockPrisma,
          publishRabbitMQ: async (routingKey, data, source) => {
            published.push({ routingKey, data, source });
            return true;
          },
          sendBatchHttp: async () => {},
        },
      );

      assert.equal(published.length, 1);
      assert.equal(published[0].routingKey, "trip.alert.matched");
      assert.equal(published[0].source, "carpooling-trips");
      assert.deepStrictEqual(published[0].data, {
        idempotencyKey: "trip.alert.matched:482:chunk:1",
        tripId: "482",
        origin: "Madrid",
        destination: "Valencia",
        date: "15/11/2026",
        time: "08:30",
        price: "18 €",
        seats: 3,
        driverName: "Carlos",
        channels: ["push", "email"],
        priority: "high",
        userIds: ["usr-101", "usr-204", "usr-389"],
      });

      const envelope = AlertasMatcherService.buildTripAlertMatchedEnvelope(
        published[0].data,
        "2026-11-10T10:30:00.000Z",
      );
      assert.deepStrictEqual(envelope, {
        event: "trip.alert.matched",
        source: "carpooling-trips",
        timestamp: "2026-11-10T10:30:00.000Z",
        data: published[0].data,
      });
    });

    it("divide en chunks cuando supera MAX_BATCH_RECIPIENTS (5000) con idempotencyKey determinista", async () => {
      const totalUsers = 10005;
      const rows = Array.from({ length: totalUsers }, (_, idx) => ({
        usuarioId: `usr-${idx + 1}`,
      }));

      const mockPrisma = {
        alertaTrayecto: {
          findMany: async () => rows,
        },
      };

      const publishedChunks = [];
      const result = await AlertasMatcherService.processTripAlertMatches(
        {
          id: "999",
          origen: "Sevilla",
          destino: "Granada",
          fecha: "2026-12-01",
          hora: "10:00",
          precio: 12,
          disponible: 2,
          organizadorId: "driver-0",
        },
        {
          prismaClient: mockPrisma,
          publishRabbitMQ: async (_rk, data) => {
            publishedChunks.push(data);
            return true;
          },
          sendBatchHttp: async () => {},
        },
      );

      assert.equal(result.matchedCount, 10005);
      assert.equal(result.chunksPublished, 3);
      assert.equal(publishedChunks.length, 3);
      assert.equal(publishedChunks[0].userIds.length, 5000);
      assert.equal(publishedChunks[1].userIds.length, 5000);
      assert.equal(publishedChunks[2].userIds.length, 5);
      assert.equal(
        publishedChunks[0].idempotencyKey,
        "trip.alert.matched:999:chunk:1",
      );
      assert.equal(
        publishedChunks[1].idempotencyKey,
        "trip.alert.matched:999:chunk:2",
      );
      assert.equal(
        publishedChunks[2].idempotencyKey,
        "trip.alert.matched:999:chunk:3",
      );
    });
  });

  describe("HTTP Fallback (/api/notifications/batch) & Observer", () => {
    it("activa HTTP fallback si RabbitMQ falla o devuelve false", async () => {
      const mockPrisma = {
        alertaTrayecto: {
          findMany: async () => [{ usuarioId: "usr-101" }],
        },
      };

      const fallbackPayloads = [];
      await AlertasMatcherService.processTripAlertMatches(
        {
          id: "482",
          origen: "Madrid",
          destino: "Valencia",
          fecha: "2026-11-15",
          hora: "08:30",
          precio: 18,
          disponible: 3,
          driverName: "Carlos",
          organizadorId: "driver-42",
        },
        {
          prismaClient: mockPrisma,
          publishRabbitMQ: async () => false,
          sendBatchHttp: async (payload) => {
            fallbackPayloads.push(payload);
          },
        },
      );

      assert.equal(fallbackPayloads.length, 1);
      assert.deepStrictEqual(fallbackPayloads[0], {
        idempotencyKey: "trip.alert.matched:482:chunk:1",
        type: "trip_alert_matched",
        channels: ["push", "email"],
        priority: "high",
        sharedData: {
          tripId: "482",
          origin: "Madrid",
          destination: "Valencia",
          date: "15/11/2026",
          time: "08:30",
          price: "18 €",
          seats: 3,
          driverName: "Carlos",
        },
        userIds: ["usr-101"],
      });
    });

    it("NotificationsAPI.sendBatchNotification envía cabeceras y body correctos y acepta 202", async () => {
      let receivedRequest = null;
      const server = http.createServer((req, res) => {
        let rawBody = "";
        req.on("data", (chunk) => {
          rawBody += chunk;
        });
        req.on("end", () => {
          receivedRequest = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: JSON.parse(rawBody),
          };
          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              batchId: "batch-1",
              deduplicated: false,
              totalRecipients: 1,
              channels: ["push", "email"],
            }),
          );
        });
      });

      await new Promise((resolve) => server.listen(0, resolve));
      const prevUrl = process.env.NOTIFICATIONS_SERVICE_URL;
      const prevKey = process.env.INTERNAL_SERVICE_API_KEY;
      process.env.NOTIFICATIONS_SERVICE_URL = `http://localhost:${server.address().port}`;
      process.env.INTERNAL_SERVICE_API_KEY = "secret-internal-key";

      try {
        const res = await NotificationsAPI.sendBatchNotification({
          idempotencyKey: "trip.alert.matched:482:chunk:1",
          type: "trip_alert_matched",
          channels: ["push", "email"],
          priority: "high",
          sharedData: {
            tripId: "482",
            origin: "Madrid",
            destination: "Valencia",
            date: "15/11/2026",
            time: "08:30",
            price: "18 €",
          },
          userIds: ["usr-101"],
        });

        assert.equal(res.success, true);
        assert.equal(receivedRequest.method, "POST");
        assert.equal(receivedRequest.url, "/api/notifications/batch");
        assert.equal(
          receivedRequest.headers["x-service-api-key"],
          "secret-internal-key",
        );
        assert.equal(
          receivedRequest.headers["idempotency-key"],
          "trip.alert.matched:482:chunk:1",
        );
        assert.equal(receivedRequest.body.type, "trip_alert_matched");
      } finally {
        if (prevUrl === undefined) delete process.env.NOTIFICATIONS_SERVICE_URL;
        else process.env.NOTIFICATIONS_SERVICE_URL = prevUrl;
        if (prevKey === undefined) delete process.env.INTERNAL_SERVICE_API_KEY;
        else process.env.INTERNAL_SERVICE_API_KEY = prevKey;
        server.close();
      }
    });

    it("trayectoEmitter y handleNuevoTrayectoCreado desacoplan errores sin lanzar excepciones", async () => {
      assert.equal(
        TRAYECTO_DOMAIN_EVENTS.NUEVO_TRAYECTO_CREADO,
        "nuevo_trayecto_creado",
      );
      assert.ok(trayectoEmitter.listenerCount("nuevo_trayecto_creado") >= 1);

      const safeResult = await handleNuevoTrayectoCreado(
        { id: "1", destino: "Madrid" },
        {
          prismaClient: {
            alertaTrayecto: {
              findMany: async () => {
                throw new Error("Simulated DB outage");
              },
            },
          },
        },
      );
      assert.equal(safeResult, null);
    });
  });
});
