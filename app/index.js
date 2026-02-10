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
import {
  startTrayectoSoonReminderCron,
  startTrayectoStatusCron,
} from "./cron-jobs.js";
import { OilPriceProvider } from "./providers/precio-oil.js";

const app = express();

await initDatabase();

startTrayectoStatusCron({
  schedule: process.env.TRAYECTO_STATUS_CRON_SCHEDULE || "*/1 * * * *",
});

startTrayectoSoonReminderCron({
  schedule: process.env.TRAYECTO_SOON_REMINDER_CRON_SCHEDULE || "*/1 * * * *",
});
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
app.delete("/api/reserva/:id", async (req, res) => {
  // Llama a la función deleteReserva del controlador de reservas
  ReservaController.deleteReserva(req, res);
});

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

// PREFERENCIAS DE VIAJE
app.get(
  "/api/preferences/definitions",
  utilsAuthentication.authenticate,
  async (req, res) => {
    PreferencesController.getDefinitions(req, res);
  },
);
app.post(
  "/users/:userId/preferences/default",
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
