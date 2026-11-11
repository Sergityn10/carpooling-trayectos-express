import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import express from "express";
import { AlertaFactory, TIPO_ALERTA } from "../../app/services/alertas/alertaFactory.js";
import { AlertasService } from "../../app/services/alertas/alertasService.js";
import { createAlertasController } from "../../app/controllers/alertas.js";
import { alertasRouter } from "../../app/routes/alertasRouter.js";
import {
  AlertaForbiddenError,
  AlertaNotFoundError,
  AlertaValidationError,
} from "../../app/Errors/AlertaErrors.js";

function createInMemoryPrismaMock(initialAlertas = []) {
  let nextId = initialAlertas.length > 0
    ? Math.max(...initialAlertas.map((a) => a.id)) + 1
    : 1;
  const rows = initialAlertas.map((a) => ({ ...a }));

  return {
    rows,
    alertaTrayecto: {
      create: async ({ data }) => {
        const record = {
          id: nextId++,
          usuarioId: data.usuarioId,
          tipo: data.tipo,
          eventoId: data.eventoId ?? null,
          destino: data.destino ?? null,
          activa: data.activa ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(record);
        return { ...record };
      },
      findMany: async ({ where, orderBy }) => {
        let result = rows.filter((r) => {
          if (where?.usuarioId !== undefined && r.usuarioId !== where.usuarioId) {
            return false;
          }
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          result = [...result].sort((a, b) => b.id - a.id);
        }
        return result.map((r) => ({ ...r }));
      },
      findUnique: async ({ where }) => {
        const found = rows.find((r) => r.id === where.id);
        return found ? { ...found } : null;
      },
      update: async ({ where, data }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) return null;
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return { ...rows[idx] };
      },
      delete: async ({ where }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) return null;
        const [removed] = rows.splice(idx, 1);
        return removed;
      },
    },
  };
}

describe("Alertas - Factory, Servicio CRUD, Controlador y Router", () => {
  describe("AlertaFactory (Patrón Factory)", () => {
    it("debe validar y construir payload STI para tipo EVENTO", () => {
      const payload = AlertaFactory.createPayload({
        tipo: TIPO_ALERTA.EVENTO,
        eventoId: "  evt-123  ",
        destino: "Madrid",
      });

      assert.deepStrictEqual(payload, {
        tipo: "EVENTO",
        eventoId: "evt-123",
        destino: null,
      });
    });

    it("debe rechazar tipo EVENTO sin eventoId", () => {
      assert.throws(
        () => AlertaFactory.createPayload({ tipo: "EVENTO", destino: "Madrid" }),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
      assert.throws(
        () => AlertaFactory.createPayload({ tipo: "EVENTO", eventoId: "   " }),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
    });

    it("debe validar y construir payload STI para tipo DESTINO", () => {
      const payload = AlertaFactory.createPayload({
        tipo: TIPO_ALERTA.DESTINO,
        destino: "  Valencia  ",
        eventoId: "evt-ignorado",
      });

      assert.deepStrictEqual(payload, {
        tipo: "DESTINO",
        eventoId: null,
        destino: "Valencia",
      });
    });

    it("debe rechazar tipo DESTINO sin destino", () => {
      assert.throws(
        () => AlertaFactory.createPayload({ tipo: "DESTINO" }),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
      assert.throws(
        () => AlertaFactory.createPayload({ tipo: "DESTINO", destino: "" }),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
    });

    it("debe rechazar tipos desconocidos o cuerpo inválido", () => {
      assert.throws(
        () => AlertaFactory.createPayload({ tipo: "PRECIO", destino: "Madrid" }),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
      assert.throws(
        () => AlertaFactory.createPayload(null),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
    });
  });

  describe("AlertasService (CRUD + Propiedad)", () => {
    it("crea alertas y lista solo las del usuario autenticado", async () => {
      const mockPrisma = createInMemoryPrismaMock();

      const a1 = await AlertasService.createAlerta(
        "usr-1",
        { tipo: "DESTINO", destino: "Valencia" },
        mockPrisma,
      );
      await AlertasService.createAlerta(
        "usr-2",
        { tipo: "EVENTO", eventoId: "evt-9" },
        mockPrisma,
      );

      assert.equal(a1.usuarioId, "usr-1");
      assert.equal(a1.tipo, "DESTINO");
      assert.equal(a1.destino, "Valencia");
      assert.equal(a1.eventoId, null);
      assert.equal(a1.activa, true);

      const usr1Alertas = await AlertasService.getAlertasByUsuario(
        "usr-1",
        mockPrisma,
      );
      assert.equal(usr1Alertas.length, 1);
      assert.equal(usr1Alertas[0].id, a1.id);
    });

    it("permite pausar/reanudar al propietario y deniega (403) a terceros", async () => {
      const mockPrisma = createInMemoryPrismaMock([
        {
          id: 10,
          usuarioId: "owner-1",
          tipo: "DESTINO",
          eventoId: null,
          destino: "Sevilla",
          activa: true,
        },
      ]);

      await assert.rejects(
        () => AlertasService.updateAlertaEstado(10, "stranger-2", false, mockPrisma),
        (err) => err instanceof AlertaForbiddenError && err.statusCode === 403,
      );

      const updated = await AlertasService.updateAlertaEstado(
        10,
        "owner-1",
        false,
        mockPrisma,
      );
      assert.equal(updated.activa, false);
    });

    it("devuelve 404 si la alerta no existe y 400 si ID o activa son inválidos", async () => {
      const mockPrisma = createInMemoryPrismaMock();

      await assert.rejects(
        () => AlertasService.updateAlertaEstado("abc", "usr-1", true, mockPrisma),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
      await assert.rejects(
        () => AlertasService.updateAlertaEstado(1, "usr-1", "true", mockPrisma),
        (err) => err instanceof AlertaValidationError && err.statusCode === 400,
      );
      await assert.rejects(
        () => AlertasService.updateAlertaEstado(999, "usr-1", false, mockPrisma),
        (err) => err instanceof AlertaNotFoundError && err.statusCode === 404,
      );
    });

    it("elimina la alerta verificando propiedad (403/404/200)", async () => {
      const mockPrisma = createInMemoryPrismaMock([
        {
          id: 5,
          usuarioId: "owner-1",
          tipo: "EVENTO",
          eventoId: "evt-1",
          destino: null,
          activa: true,
        },
      ]);

      await assert.rejects(
        () => AlertasService.deleteAlerta(5, "other-user", mockPrisma),
        (err) => err instanceof AlertaForbiddenError && err.statusCode === 403,
      );
      await assert.rejects(
        () => AlertasService.deleteAlerta(404, "owner-1", mockPrisma),
        (err) => err instanceof AlertaNotFoundError && err.statusCode === 404,
      );

      await AlertasService.deleteAlerta(5, "owner-1", mockPrisma);
      assert.equal(mockPrisma.rows.length, 0);
    });
  });

  describe("AlertasController & alertasRouter (HTTP endpoints)", () => {
    it("alertasRouter protege todos los endpoints con JWT (401 sin token)", async () => {
      const app = express();
      app.use(express.json());
      app.use("/api/alertas", alertasRouter);

      const server = app.listen(0);
      const baseUrl = `http://localhost:${server.address().port}`;

      try {
        const resGet = await fetch(`${baseUrl}/api/alertas`);
        assert.equal(resGet.status, 401);

        const resPost = await fetch(`${baseUrl}/api/alertas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "DESTINO", destino: "Madrid" }),
        });
        assert.equal(resPost.status, 401);

        const resPatch = await fetch(`${baseUrl}/api/alertas/1/estado`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activa: false }),
        });
        assert.equal(resPatch.status, 401);

        const resDelete = await fetch(`${baseUrl}/api/alertas/1`, {
          method: "DELETE",
        });
        assert.equal(resDelete.status, 401);
      } finally {
        server.close();
      }
    });

    it("devuelve códigos HTTP semánticos (201, 200, 400, 403, 404, 500)", async () => {
      const mockPrisma = createInMemoryPrismaMock();
      const boundService = {
        createAlerta: (uid, body) => AlertasService.createAlerta(uid, body, mockPrisma),
        getAlertasByUsuario: (uid) => AlertasService.getAlertasByUsuario(uid, mockPrisma),
        updateAlertaEstado: (id, uid, activa) =>
          AlertasService.updateAlertaEstado(id, uid, activa, mockPrisma),
        deleteAlerta: (id, uid) => AlertasService.deleteAlerta(id, uid, mockPrisma),
      };
      const controller = createAlertasController(boundService);

      let currentUserId = "usr-100";
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = { id: currentUserId };
        next();
      });
      app.post("/api/alertas", controller.crearAlerta);
      app.get("/api/alertas", controller.obtenerAlertas);
      app.patch("/api/alertas/:id/estado", controller.actualizarEstadoAlerta);
      app.delete("/api/alertas/:id", controller.eliminarAlerta);

      const server = app.listen(0);
      const baseUrl = `http://localhost:${server.address().port}`;

      try {
        // 400 validation error
        const badRes = await fetch(`${baseUrl}/api/alertas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "EVENTO" }),
        });
        assert.equal(badRes.status, 400);

        // 201 created
        const createRes = await fetch(`${baseUrl}/api/alertas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "DESTINO", destino: "Valencia" }),
        });
        assert.equal(createRes.status, 201);
        const createdJson = await createRes.json();
        assert.equal(createdJson.alerta.destino, "Valencia");
        const alertaId = createdJson.alerta.id;

        // 200 get
        const listRes = await fetch(`${baseUrl}/api/alertas`);
        assert.equal(listRes.status, 200);
        const listJson = await listRes.json();
        assert.equal(listJson.alertas.length, 1);

        // 403 when another user tries to pause/delete
        currentUserId = "usr-intruder";
        const forbiddenPatch = await fetch(
          `${baseUrl}/api/alertas/${alertaId}/estado`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activa: false }),
          },
        );
        assert.equal(forbiddenPatch.status, 403);

        const forbiddenDelete = await fetch(`${baseUrl}/api/alertas/${alertaId}`, {
          method: "DELETE",
        });
        assert.equal(forbiddenDelete.status, 403);

        // 200 patch by owner
        currentUserId = "usr-100";
        const okPatch = await fetch(`${baseUrl}/api/alertas/${alertaId}/estado`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activa: false }),
        });
        assert.equal(okPatch.status, 200);
        const okPatchJson = await okPatch.json();
        assert.equal(okPatchJson.alerta.activa, false);

        // 200 delete by owner
        const okDelete = await fetch(`${baseUrl}/api/alertas/${alertaId}`, {
          method: "DELETE",
        });
        assert.equal(okDelete.status, 200);

        // 404 after deletion
        const notFoundRes = await fetch(`${baseUrl}/api/alertas/${alertaId}`, {
          method: "DELETE",
        });
        assert.equal(notFoundRes.status, 404);
      } finally {
        server.close();
      }

      // 500 unexpected server error
      const brokenController = createAlertasController({
        getAlertasByUsuario: async () => {
          throw new Error("DB down");
        },
      });
      let statusCaptured = null;
      let bodyCaptured = null;
      await brokenController.obtenerAlertas(
        { user: { id: "usr-1" } },
        {
          status: (code) => {
            statusCaptured = code;
            return {
              send: (body) => {
                bodyCaptured = body;
              },
            };
          },
        },
      );
      assert.equal(statusCaptured, 500);
      assert.equal(bodyCaptured.status, "Error");
    });
  });
});
