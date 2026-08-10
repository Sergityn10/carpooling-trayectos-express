import cookieParser from "cookie-parser";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import { database } from "./database.js";
import { initDatabase } from "./database.js";
import { TrayectosController } from "./controllers/trayectos.js";
import { ReservaController } from "./controllers/reserva.js";
import { OpinionsController } from "./controllers/opinions.js";
import { PreferencesController } from "./controllers/preferences.js";
import { utilsAuthentication } from "./utils/authentication.js";
import { UbicacionesController } from "./controllers/ubicaciones.js";
import { FrequentRoutesController } from "./controllers/frequents-routes.js";
import { RecorridosController } from "./controllers/recorridos.js";
import { RecogidasController } from "./controllers/recogidas.js";
import {
  startTrayectoSoonReminderCron,
  startTrayectoChatCleanupCron,
  startTrayectoStatusCron,
} from "./cron-jobs.js";
import { OilPriceProvider } from "./providers/precio-oil.js";
import { CAEUtils } from "./utils/cae.js";
import { AdminController } from "./controllers/admin.js";
import { startRabbitMQ } from "./rabbitmq/index.js";

const app = express();
app.set("etag", false);

try {
  await initDatabase();
} catch (error) {
  console.error("Error al inicializar la base de datos:", error.message);
}

startTrayectoStatusCron({
  schedule: process.env.TRAYECTO_STATUS_CRON_SCHEDULE || "*/1 * * * *",
});

startTrayectoSoonReminderCron({
  schedule: process.env.TRAYECTO_SOON_REMINDER_CRON_SCHEDULE || "*/1 * * * *",
});

startTrayectoChatCleanupCron({
  schedule: process.env.TRAYECTO_CHAT_CLEANUP_CRON_SCHEDULE || "0 3 * * *",
});

startRabbitMQ();

let port = process.env.PORT || 4001;
//Configuracion del puerto del servidor
app.set("port", port);
app.listen(app.get("port"), () => {
  console.log("Servidor iniciado en el puerto " + app.get("port"));
});
app.disable("x-powered-by"); // Desactiva el encabezado x-powered-by
let list_origins = [
  `${process.env.USUARIOS_URL}`,
  `${process.env.FRONTEND_URL}`,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://www.youconnext.es",
"https://admin.youconnext.es"
];
//Middewares
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(
  cors({
    origin: list_origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  }),
);

app.get("/api/trayecto", utilsAuthentication.authenticate, async (req, res) => {
  TrayectosController.obtenerTrayectos(req, res);
});

app.get(
  "/api/trayecto/search",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.buscarTrayectos(req, res);
  },
);

app.get(
  "/api/trayecto/mis-trayectos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.obtenerMisTrayectos(req, res);
  },
);

app.get(
  "/api/trayecto/proximos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.obtenerProximosTrayectos(req, res);
  },
);

app.get(
  "/api/trayecto/:id/completo",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.obtenerTrayectoCompleto(req, res);
  },
);

app.get(
  "/api/trayecto/:id/estado",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.obtenerEstadoTrayectoPasajero(req, res);
  },
);

app.get(
  "/api/trayecto/:id",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.obtenerTrayectoPorId(req, res);
  },
);

app.post(
  "/api/trayecto",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.crearTrayecto(req, res);
  },
);

app.post(
  "/api/trayecto/evento",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.crearTrayectoEvento(req, res);
  },
);

app.get(
  "/api/trayecto/evento/:eventoId",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.obtenerTrayectosPorEvento(req, res);
  },
);

app.get(
  "/api/trayecto/evento/:eventoId/cerca",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.buscarTrayectosPorEvento(req, res);
  },
);

app.put("/api/trayecto/update/id/:id", async (req, res) => {
  TrayectosController.updateLatLongById(req, res);
});
app.put("/api/trayecto/update", async (req, res) => {
  TrayectosController.updateLatLong(req, res);
});
app.put("/api/trayecto/:id", async (req, res) => {
  TrayectosController.actualizarTrayecto(req, res);
});
app.patch("/api/trayecto/:id", async (req, res) => {
  TrayectosController.patchTrayecto(req, res);
});
app.post(
  "/api/trayecto/:id/finalizar",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.finalizarTrayecto(req, res);
  },
);

app.post(
  "/api/trayecto/:id/iniciar",
  utilsAuthentication.authenticate,
  async (req, res) => {
    TrayectosController.iniciarTrayecto(req, res);
  },
);

app.post(
  "/api/trayecto/:id/recorrido",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecorridosController.guardarUbicacion(req, res);
  },
);

app.get(
  "/api/trayecto/:id/recorrido",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecorridosController.obtenerRecorrido(req, res);
  },
);

app.post(
  "/api/trayecto/:id/recoger",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecogidasController.crearRecogida(req, res);
  },
);

app.get(
  "/api/trayecto/:id/recoger",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecogidasController.obtenerRecogidas(req, res);
  },
);

app.get(
  "/api/trayecto/:id/recoger/:idUser",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecogidasController.obtenerRecogidaPorUsuario(req, res);
  },
);

app.delete(
  "/api/trayecto/:id/recoger/:idUser",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecogidasController.eliminarRecogida(req, res);
  },
);

app.post(
  "/api/trayecto/:id/llegada",
  utilsAuthentication.authenticate,
  async (req, res) => {
    RecogidasController.registrarLlegadaDestino(req, res);
  },
);

app.get(
  "/api/trayecto/conductor/:id",
  utilsAuthentication.tryAuthenticate,
  async (req, res) => {
    TrayectosController.obtenerTrayectosPorConductor(req, res);
  },
);
app.delete("/api/trayecto/:id", async (req, res) => {
  TrayectosController.eliminarTrayecto(req, res);
});

//CAE
app.get(
  "/api/cae/balance",
  utilsAuthentication.authenticate,
  async (req, res) => {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .send({ status: "Error", message: "No autenticado" });
    }
    try {
      const balance = await CAEUtils.getCAEBalance(userId);
      return res.status(200).json({
        status: "Success",
        ...balance,
      });
    } catch (e) {
      console.error("[CAE] Error obteniendo balance:", e);
      return res
        .status(500)
        .send({ status: "Error", message: "Error al obtener balance CAE" });
    }
  },
);

app.patch(
  "/api/cae/:id/approve",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .send({ status: "Error", message: "Solo un admin puede aprobar CAEs" });
    }
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .send({ status: "Error", message: "ID de CAE inválido" });
    }
    try {
      await CAEUtils.approveCAE(id);
      return res.status(200).json({
        status: "Success",
        message: "CAE aprobado correctamente",
      });
    } catch (e) {
      console.error("[CAE] Error aprobando CAE:", e);
      const status = e.message?.includes("no encontrado")
        ? 404
        : e.message?.includes("no está en revisión")
          ? 409
          : 500;
      return res.status(status).send({
        status: "Error",
        message: e.message ?? "Error al aprobar CAE",
      });
    }
  },
);

app.get("/api/cae", utilsAuthentication.authenticate, async (req, res) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .send({ status: "Error", message: "Solo un admin puede listar CAEs" });
  }
  try {
    const status = req.query.status || undefined;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await CAEUtils.listAllCAEs({ status, page, limit });
    return res.status(200).json({ status: "Success", ...result });
  } catch (e) {
    console.error("[CAE] Error listando CAEs:", e);
    return res
      .status(500)
      .send({ status: "Error", message: "Error al listar CAEs" });
  }
});

app.get(
  "/api/cae/user/:userId",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede ver CAEs de un usuario",
      });
    }
    const { userId } = req.params;
    if (!userId) {
      return res
        .status(400)
        .send({ status: "Error", message: "ID de usuario inválido" });
    }
    try {
      const result = await CAEUtils.listCAEsByUser(userId);
      return res.status(200).json({ status: "Success", ...result });
    } catch (e) {
      console.error("[CAE] Error listando CAEs por usuario:", e);
      return res
        .status(500)
        .send({ status: "Error", message: "Error al listar CAEs del usuario" });
    }
  },
);

app.get(
  "/api/cae/reports/summary",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede ver el resumen de reportes CAE",
      });
    }
    try {
      const summary = await CAEUtils.getCAEReportSummary();
      return res.status(200).json({ status: "Success", ...summary });
    } catch (e) {
      console.error("[CAE] Error obteniendo resumen de reportes:", e);
      return res.status(500).send({
        status: "Error",
        message: "Error al obtener resumen de reportes CAE",
      });
    }
  },
);

app.get(
  "/api/cae/reports",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede listar reportes CAE",
      });
    }
    try {
      const status = req.query.status || undefined;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const result = await CAEUtils.listCAEReports({ status, page, limit });
      return res.status(200).json({ status: "Success", ...result });
    } catch (e) {
      console.error("[CAE] Error listando reportes:", e);
      return res
        .status(500)
        .send({ status: "Error", message: "Error al listar reportes CAE" });
    }
  },
);

app.post(
  "/api/cae/reports",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede crear reportes CAE",
      });
    }
    const { name } = req.body || {};
    try {
      const report = await CAEUtils.createCAEReport(name);
      return res.status(201).json({ status: "Success", report });
    } catch (e) {
      console.error("[CAE] Error creando reporte:", e);
      const status = e.message?.includes("No hay CAEs") ? 400 : 500;
      return res.status(status).send({
        status: "Error",
        message: e.message ?? "Error al crear reporte CAE",
      });
    }
  },
);

app.get(
  "/api/cae/reports/export",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede exportar reportes CAE",
      });
    }
    try {
      const authHeaders = {};
      const bearerToken = req.headers?.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice("Bearer ".length).trim()
        : null;
      if (bearerToken) {
        authHeaders.Authorization = `Bearer ${bearerToken}`;
      }
      const reports = await CAEUtils.listCAEReports({ page: 1, limit: 1000 });
      const allData = await Promise.all(
        reports.items.map((r) =>
          CAEUtils.getCAEReportData(r.id, { headers: authHeaders }).catch(
            () => null,
          ),
        ),
      );
      const exportData = allData.filter(Boolean);
      return res.status(200).json({ status: "Success", reports: exportData });
    } catch (e) {
      console.error("[CAE] Error exportando reportes:", e);
      return res
        .status(500)
        .send({ status: "Error", message: "Error al exportar reportes CAE" });
    }
  },
);

app.get(
  "/api/cae/reports/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede ver reportes CAE",
      });
    }
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .send({ status: "Error", message: "ID de reporte inválido" });
    }
    try {
      const authHeaders = {};
      const bearerToken = req.headers?.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice("Bearer ".length).trim()
        : null;
      if (bearerToken) {
        authHeaders.Authorization = `Bearer ${bearerToken}`;
      }
      const data = await CAEUtils.getCAEReportData(id, {
        headers: authHeaders,
      });
      return res.status(200).json({ status: "Success", ...data });
    } catch (e) {
      console.error("[CAE] Error obteniendo reporte:", e);
      const status = e.message?.includes("no encontrado") ? 404 : 500;
      return res.status(status).send({
        status: "Error",
        message: e.message ?? "Error al obtener reporte CAE",
      });
    }
  },
);

app.patch(
  "/api/cae/reports/:id/status",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede cambiar el estado de reportes CAE",
      });
    }
    const { id } = req.params;
    const { status } = req.body || {};
    if (!id) {
      return res
        .status(400)
        .send({ status: "Error", message: "ID de reporte inválido" });
    }
    if (!status) {
      return res
        .status(400)
        .send({ status: "Error", message: "El campo 'status' es requerido" });
    }
    try {
      const report = await CAEUtils.updateCAEReportStatus(id, status);
      return res.status(200).json({ status: "Success", report });
    } catch (e) {
      console.error("[CAE] Error actualizando estado del reporte:", e);
      const httpStatus = e.message?.includes("no encontrado")
        ? 404
        : e.message?.includes("Estado inválido")
          ? 400
          : 500;
      return res.status(httpStatus).send({
        status: "Error",
        message: e.message ?? "Error al actualizar estado del reporte",
      });
    }
  },
);

app.delete(
  "/api/cae/reports/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede eliminar reportes CAE",
      });
    }
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .send({ status: "Error", message: "ID de reporte inválido" });
    }
    try {
      const result = await CAEUtils.deleteCAEReport(id);
      return res.status(200).json({ status: "Success", ...result });
    } catch (e) {
      console.error("[CAE] Error eliminando reporte:", e);
      const httpStatus = e.message?.includes("no encontrado") ? 404 : 500;
      return res.status(httpStatus).send({
        status: "Error",
        message: e.message ?? "Error al eliminar reporte CAE",
      });
    }
  },
);

//Comentarios

app.post(
  "/api/comments",
  utilsAuthentication.authenticate,
  async (req, res) => {
    // Llama a la función addOpinion del controlador de opiniones
    OpinionsController.addOpinion(req, res);
  },
);

app.get("/api/comments/user_id_commentator/:userId", async (req, res) => {
  // Llama a la función getOpinionByUserIdCommented del controlador de opiniones
  OpinionsController.getOpinionByUserIdCommentator(req, res);
});

app.get("/api/comments/user_id_trayect/:userId", async (req, res) => {
  // Llama a la función getOpinionByUserIdCommented del controlador de opiniones
  OpinionsController.getOpinionByUserIdTrayect(req, res);
});
app.get("/api/comments/travelId/:travelId", async (req, res) => {
  OpinionsController.getOpinionsByTravelId(req, res);
});
app.delete("/api/comments/:id", async (req, res) => {
  OpinionsController.deleteOpinion(req, res);
});
app.patch("/api/comments/:id", async (req, res) => {
  OpinionsController.patchComment(req, res);
});

//RESERVAS
app.post("/api/reserva", utilsAuthentication.authenticate, async (req, res) => {
  // Llama a la función addReserva del controlador de reservas
  ReservaController.addReserva(req, res);
});

app.get(
  "/api/reserva/stats/:userId",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.getUserStats(req, res);
  },
);

app.get("/api/reserva/profile/:userId", async (req, res) => {
  ReservaController.getPublicProfile(req, res);
});

app.post(
  "/api/reserva/qr",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.reservaQR(req, res);
  },
);

app.get(
  "/api/reserva/userId/:userIdParam",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.obtenerMisReservas(req, res);
  },
);
app.get(
  "/api/reserva/trayectoId/:travelId",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.getReservasByTravelId(req, res);
  },
);
app.delete(
  "/api/reserva/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    // Llama a la función deleteReserva del controlador de reservas
    ReservaController.deleteReserva(req, res);
  },
);

app.post(
  "/api/reserva/:id/success",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.confirmarViajeExitoso(req, res);
  },
);

app.post(
  "/api/reserva/:id/issue",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.reclamarViaje(req, res);
  },
);

app.post(
  "/api/reserva/resume",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.retomarPagoReserva(req, res);
  },
);

app.patch(
  "/api/reserva/:id/status",
  utilsAuthentication.authenticate,
  async (req, res) => {
    ReservaController.actualizarStatusReserva(req, res);
  },
);

// PREFERENCIAS DE VIAJE
app.get(
  "/api/preferences/definitions",
  utilsAuthentication.authenticate,
  async (req, res) => {
    PreferencesController.getDefinitions(req, res);
  },
);
app.post(
  "/api/users/:userId/preferences/default",
  PreferencesController.insertDefaultUserPreferences,
);

app.get(
  "/api/preferences/me",
  utilsAuthentication.authenticate,
  async (req, res) => {
    PreferencesController.getMyPreferences(req, res);
  },
);

app.put(
  "/api/preferences/me",
  utilsAuthentication.authenticate,
  async (req, res) => {
    PreferencesController.updateMyPreferences(req, res);
  },
);

app.get(
  "/api/preferences/user_id/:userIdParam",
  utilsAuthentication.authenticate,
  async (req, res) => {
    PreferencesController.getUserPreferences(req, res);
  },
);

// UBICACIONES
app.post(
  "/api/ubicacion",
  utilsAuthentication.authenticate,
  async (req, res) => {
    UbicacionesController.crearUbicacion(req, res);
  },
);

app.get("/api/ubicacion", async (req, res) => {
  UbicacionesController.obtenerUbicaciones(req, res);
});

// IMPORTANTE: ruta de user_id antes que :id
app.get(
  "/api/ubicacion/user_id/:userIdParam",
  utilsAuthentication.authenticate,
  async (req, res) => {
    UbicacionesController.obtenerUbicacionesPorUsuario(req, res);
  },
);

app.get("/api/ubicacion/:id", async (req, res) => {
  UbicacionesController.obtenerUbicacionPorId(req, res);
});

app.put(
  "/api/ubicacion/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    UbicacionesController.actualizarUbicacion(req, res);
  },
);

app.delete(
  "/api/ubicacion/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    UbicacionesController.eliminarUbicacion(req, res);
  },
);

// FREQUENT ROUTES (plantillas de trayecto)
app.post(
  "/api/frequent-routes",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.createFrequentRoute(req, res);
  },
);

app.get(
  "/api/frequent-routes/me",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.getMyFrequentRoutes(req, res);
  },
);

app.get(
  "/api/frequent-routes/user_id/:userIdParam",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.getFrequentRoutesByUser(req, res);
  },
);

app.get(
  "/api/frequent-routes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.getFrequentRouteById(req, res);
  },
);

app.patch(
  "/api/frequent-routes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.patchFrequentRoute(req, res);
  },
);

app.delete(
  "/api/frequent-routes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    FrequentRoutesController.deleteFrequentRoute(req, res);
  },
);

//OIL-PRICING Y GASOLINERAS

// Obtiene el listado de provincias disponible en la API de precios de combustible.
app.get("/api/oil/provincias", async (req, res) => {
  try {
    const data = await OilPriceProvider.getProvincias();
    return res.json(data);
  } catch (error) {
    return res
      .status(500)
      .json({ message: error?.message ?? "Error consultando provincias" });
  }
});

// Obtiene el listado de municipios de una provincia (requiere :idProvincia).
app.get("/api/oil/provincias/:idProvincia/municipios", async (req, res) => {
  try {
    const { idProvincia } = req.params;
    if (!idProvincia)
      return res.status(400).json({ message: "idProvincia requerido" });
    const data = await OilPriceProvider.getMunicipiosByProvincia(idProvincia);
    return res.json(data);
  } catch (error) {
    return res
      .status(500)
      .json({ message: error?.message ?? "Error consultando municipios" });
  }
});

// Obtiene las estaciones de servicio de un municipio (requiere :idMunicipio).
app.get("/api/oil/estaciones/municipio/:idMunicipio", async (req, res) => {
  try {
    const { idMunicipio } = req.params;
    if (!idMunicipio)
      return res.status(400).json({ message: "idMunicipio requerido" });
    const data = await OilPriceProvider.getEstacionesByMunicipio(idMunicipio);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando estaciones por municipio",
    });
  }
});

// Busca estaciones por radio desde una coordenada (query: latitud,longitud,radio,pagina,limite).
app.get("/api/oil/estaciones/radio", async (req, res) => {
  try {
    const { latitud, longitud, radio, pagina, limite } = req.query;
    if (latitud === undefined || longitud === undefined) {
      return res
        .status(400)
        .json({ message: "latitud y longitud son requeridos" });
    }
    const data = await OilPriceProvider.getEstacionesRadio({
      latitud: Number(latitud),
      longitud: Number(longitud),
      radio: radio === undefined ? undefined : Number(radio),
      pagina: pagina === undefined ? undefined : Number(pagina),
      limite: limite === undefined ? undefined : Number(limite),
    });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando estaciones por radio",
    });
  }
});

// Devuelve los detalles de una estación de servicio por id (requiere :idEstacion).
app.get("/api/oil/estaciones/:idEstacion/detalles", async (req, res) => {
  try {
    const { idEstacion } = req.params;
    if (!idEstacion)
      return res.status(400).json({ message: "idEstacion requerido" });
    const data = await OilPriceProvider.getEstacionDetalles(idEstacion);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando detalles de estación",
    });
  }
});

// Devuelve estaciones cercanas a una estación concreta (requiere :idEstacion, query: radio opcional).
app.get("/api/oil/estaciones/:idEstacion/cerca", async (req, res) => {
  try {
    const { idEstacion } = req.params;
    const { radio } = req.query;
    if (!idEstacion)
      return res.status(400).json({ message: "idEstacion requerido" });
    const data = await OilPriceProvider.getEstacionesCerca(idEstacion, {
      radio: radio === undefined ? undefined : Number(radio),
    });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando estaciones cercanas",
    });
  }
});

// Devuelve el histórico de precios de una estación (requiere :idEstacion, query: fechaInicio/fechaFin opcionales).
app.get("/api/oil/estaciones/:idEstacion/historico", async (req, res) => {
  try {
    const { idEstacion } = req.params;
    const { fechaInicio, fechaFin } = req.query;
    if (!idEstacion)
      return res.status(400).json({ message: "idEstacion requerido" });
    const data = await OilPriceProvider.getEstacionHistorico(idEstacion, {
      fechaInicio,
      fechaFin,
    });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando histórico de estación",
    });
  }
});

// Devuelve el precio medio diario (query: idFuelType, fechaInicio, fechaFin).
app.get("/api/oil/precio-medio-diario", async (req, res) => {
  try {
    const { idFuelType, fechaInicio, fechaFin } = req.query;
    const data = await OilPriceProvider.getPrecioMedioDiario({
      idFuelType: idFuelType === undefined ? undefined : Number(idFuelType),
      fechaInicio,
      fechaFin,
    });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando precio medio diario",
    });
  }
});

// Devuelve precios medios por provincia usando su id (requiere :idProvincia, query: idFuelType opcional).
app.get("/api/oil/precios/medios/provincia/:idProvincia", async (req, res) => {
  try {
    const { idProvincia } = req.params;
    const { idFuelType } = req.query;
    if (!idProvincia)
      return res.status(400).json({ message: "idProvincia requerido" });
    const data = await OilPriceProvider.getPreciosMediosByProvinciaId(
      idProvincia,
      idFuelType === undefined ? undefined : Number(idFuelType),
    );
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message:
        error?.message ?? "Error consultando precios medios por provincia",
    });
  }
});

// Devuelve precios medios por provincia usando su nombre (requiere :provincia, query: idFuelType opcional).
app.get(
  "/api/oil/precios/medios/provincia-nombre/:provincia",
  async (req, res) => {
    try {
      const { provincia } = req.params;
      const { idFuelType } = req.query;
      if (!provincia)
        return res.status(400).json({ message: "provincia requerida" });
      const data = await OilPriceProvider.getPreciosMediosByProvinciaNombre(
        provincia,
        idFuelType === undefined ? undefined : Number(idFuelType),
      );
      return res.json(data);
    } catch (error) {
      return res.status(500).json({
        message:
          error?.message ?? "Error consultando precios medios por provincia",
      });
    }
  },
);

// Devuelve el precio medio de gasoil para una provincia por id (requiere :idProvincia).
app.get("/api/oil/precios/gasoil/provincia/:idProvincia", async (req, res) => {
  try {
    const { idProvincia } = req.params;
    if (!idProvincia)
      return res.status(400).json({ message: "idProvincia requerido" });
    const averagePrice =
      await OilPriceProvider.getGasoilAveragePriceByProvinciaId(idProvincia);
    return res.json({ idProvincia, averagePrice });
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando precio medio de gasoil",
    });
  }
});

// Admin: listar todos los trayectos con filtros y paginación
app.get(
  "/api/admin/trayectos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    TrayectosController.adminGetAllTrayectos(req, res);
  },
);

// Admin: obtener trayecto por id con detalles completos
app.get(
  "/api/admin/trayectos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    TrayectosController.adminGetTrayectoById(req, res);
  },
);

// Admin: actualizar trayecto (campos permitidos)
app.put(
  "/api/admin/trayectos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    TrayectosController.adminUpdateTrayecto(req, res);
  },
);

// Admin: eliminar trayecto
app.delete(
  "/api/admin/trayectos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    TrayectosController.adminDeleteTrayecto(req, res);
  },
);

// ============= ADMIN: RESERVAS =============
app.get(
  "/api/admin/reservas",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllReservas(req, res);
  },
);

app.get(
  "/api/admin/reservas/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetReservaById(req, res);
  },
);

app.put(
  "/api/admin/reservas/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminUpdateReserva(req, res);
  },
);

app.delete(
  "/api/admin/reservas/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteReserva(req, res);
  },
);

// ============= ADMIN: COMMENTS =============
app.get(
  "/api/admin/comments",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllComments(req, res);
  },
);

app.get(
  "/api/admin/comments/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetCommentById(req, res);
  },
);

app.put(
  "/api/admin/comments/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminUpdateComment(req, res);
  },
);

app.delete(
  "/api/admin/comments/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteComment(req, res);
  },
);

// ============= ADMIN: PAGOS =============
app.get(
  "/api/admin/pagos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllPagos(req, res);
  },
);

app.get(
  "/api/admin/pagos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetPagoById(req, res);
  },
);

app.delete(
  "/api/admin/pagos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeletePago(req, res);
  },
);

// ============= ADMIN: RECORRIDOS =============
app.get(
  "/api/admin/recorridos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllRecorridos(req, res);
  },
);

app.delete(
  "/api/admin/recorridos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteRecorrido(req, res);
  },
);

app.delete(
  "/api/admin/recorridos/trayecto/:id_trayecto",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteRecorridosByTrayecto(req, res);
  },
);

// ============= ADMIN: EVENTOS TRAYECTO =============
app.get(
  "/api/admin/eventos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllEventos(req, res);
  },
);

app.delete(
  "/api/admin/eventos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteEvento(req, res);
  },
);

app.delete(
  "/api/admin/eventos/trayecto/:id_trayecto",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteEventosByTrayecto(req, res);
  },
);

// ============= ADMIN: TRAMOS =============
app.get(
  "/api/admin/tramos",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllTramos(req, res);
  },
);

app.delete(
  "/api/admin/tramos/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteTramo(req, res);
  },
);

app.delete(
  "/api/admin/tramos/trayecto/:id_trayecto",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteTramosByTrayecto(req, res);
  },
);

// ============= ADMIN: UBICACIONES =============
app.get(
  "/api/admin/ubicaciones",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllUbicaciones(req, res);
  },
);

app.delete(
  "/api/admin/ubicaciones/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteUbicacion(req, res);
  },
);

// ============= ADMIN: FREQUENT ROUTES =============
app.get(
  "/api/admin/frequent-routes",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllFrequentRoutes(req, res);
  },
);

app.delete(
  "/api/admin/frequent-routes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteFrequentRoute(req, res);
  },
);

// ============= ADMIN: INFO CAEs =============
app.get(
  "/api/admin/caes",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminGetAllInfoCAEs(req, res);
  },
);

app.put(
  "/api/admin/caes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminUpdateInfoCAE(req, res);
  },
);

app.delete(
  "/api/admin/caes/:id",
  utilsAuthentication.authenticate,
  async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).send({
        status: "Error",
        message: "Solo un admin puede acceder a este endpoint",
      });
    }
    AdminController.adminDeleteInfoCAE(req, res);
  },
);

// Devuelve el precio medio de gasoil para una provincia por nombre (requiere :provincia).
app.get(
  "/api/oil/precios/gasoil/provincia-nombre/:provincia",
  async (req, res) => {
    try {
      const { provincia } = req.params;
      if (!provincia)
        return res.status(400).json({ message: "provincia requerida" });
      const averagePrice =
        await OilPriceProvider.getGasoilAveragePriceByProvinciaNombre(
          provincia,
        );
      return res.json({ provincia, averagePrice });
    } catch (error) {
      return res.status(500).json({
        message: error?.message ?? "Error consultando precio medio de gasoil",
      });
    }
  },
);

// Devuelve precios para una provincia por nombre (requiere :provincia, query: idFuelType opcional).
app.get("/api/oil/precios/provincia/:provincia", async (req, res) => {
  try {
    const { provincia } = req.params;
    const { idFuelType } = req.query;
    if (!provincia)
      return res.status(400).json({ message: "provincia requerida" });
    const data = await OilPriceProvider.getPriceInProvince(
      provincia,
      idFuelType === undefined ? undefined : Number(idFuelType),
    );
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? "Error consultando precios por provincia",
    });
  }
});
