import cookieParser from "cookie-parser"
import express from "express"
import morgan from "morgan"
import cors from "cors"
import {database} from "./database.js"
import { TrayectosController } from "./controllers/trayectos.js"
import { ReservaController } from "./controllers/reserva.js"
import { OpinionsController } from "./controllers/opinions.js"
import { utilsAuthentication } from "./utils/authentication.js"
import { UbicacionesController } from "./controllers/ubicaciones.js";

const app = express()

//Configuracion del puerto del servidor
app.set("port",4001)
app.listen(app.get("port"), () => {
    console.log("Servidor iniciado en el puerto " + app.get("port"))
})
app.disable("x-powered-by") // Desactiva el encabezado x-powered-by

//Middewares
app.use(express.json())
app.use(morgan("dev"))
app.use(cookieParser())
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
}))



app.get("/api/trayecto", utilsAuthentication.authenticate, async (req, res) => {
    TrayectosController.obtenerTrayectos(req, res);
})

app.get("/api/trayecto/search", async (req, res) => {
  TrayectosController.buscarTrayectos(req, res);
});

app.get("/api/trayecto/mis-trayectos", utilsAuthentication.authenticate, async (req, res) => {
    TrayectosController.obtenerMisTrayectos(req, res);
})

app.get("/api/trayecto/:id", async (req, res) => {
    TrayectosController.obtenerTrayectoPorId(req, res);
})

app.post("/api/trayecto", utilsAuthentication.authenticate, async (req, res) => {
    TrayectosController.crearTrayecto(req, res);
})

app.put("/api/trayecto/update/id/:id", async (req, res) => {
    TrayectosController.updateLatLongById(req, res);
})
app.put("/api/trayecto/update", async (req, res) => {
    TrayectosController.updateLatLong(req, res);
})
app.put("/api/trayecto/:id", async (req, res) => {
    TrayectosController.actualizarTrayecto(req, res);
})
app.patch("/api/trayecto/:id", async (req, res) => {
    TrayectosController.patchTrayecto(req, res);
})
app.get("/api/trayecto/conductor/:username", async (req, res) => {
    TrayectosController.obtenerTrayectosPorConductor(req, res);
})
app.delete("/api/trayecto/:id", async (req, res) => {
    TrayectosController.eliminarTrayecto(req, res);
})


//Comentarios 

app.post("/api/comments", async (req, res) => {
    // Llama a la función addOpinion del controlador de opiniones
    OpinionsController.addOpinion(req, res);
});

app.get("/api/comments/username_commentator/:username", async (req, res) => {
    // Llama a la función getOpinionByUsernameCommented del controlador de opiniones
    OpinionsController.getOpinionByUsernameCommentator(req, res);
});

app.get("/api/comments/username_trayect/:username", async (req, res) => {
    // Llama a la función getOpinionByUsernameCommented del controlador de opiniones
    OpinionsController.getOpinionByUsernameTrayect(req, res);
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
app.post("/api/reserva",utilsAuthentication.authenticate, async (req, res) => {
    // Llama a la función addReserva del controlador de reservas
    ReservaController.addReserva(req, res);
});

app.get("/api/reserva/username/:usernameParam", utilsAuthentication.authenticate, async (req, res) => {
    ReservaController.obtenerMisReservas(req, res);
})
app.get("/api/reserva/trayectoId/:travelId", utilsAuthentication.authenticate, async (req, res) => {
    ReservaController.getReservasByTravelId(req, res);
});
app.delete("/api/reserva/:id", async (req, res) => {
    // Llama a la función deleteReserva del controlador de reservas
    ReservaController.deleteReserva(req, res);
});

//UBICACIONES

// UBICACIONES
app.post("/api/ubicacion", utilsAuthentication.authenticate, async (req, res) => {
  UbicacionesController.crearUbicacion(req, res);
});

app.get("/api/ubicacion", async (req, res) => {
  UbicacionesController.obtenerUbicaciones(req, res);
});

// IMPORTANTE: ruta de username antes que :id
app.get("/api/ubicacion/username/:usernameParam", utilsAuthentication.authenticate, async (req, res) => {
  UbicacionesController.obtenerUbicacionesPorUsuario(req, res);
});

app.get("/api/ubicacion/:id", async (req, res) => {
  UbicacionesController.obtenerUbicacionPorId(req, res);
});

app.put("/api/ubicacion/:id", utilsAuthentication.authenticate, async (req, res) => {
  UbicacionesController.actualizarUbicacion(req, res);
});

app.delete("/api/ubicacion/:id", utilsAuthentication.authenticate, async (req, res) => {
  UbicacionesController.eliminarUbicacion(req, res);
});