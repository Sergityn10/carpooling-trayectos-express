import cookieParser from "cookie-parser"
import express from "express"
import morgan from "morgan"
import cors from "cors"
import {database} from "./database.js"
import { TrayectosController } from "./controllers/trayectos.js"
import { ReservaController } from "./controllers/reserva.js"
import { OpinionsController } from "./controllers/opinions.js"
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
    methods: ["GET", "POST", "PUT", "DELETE"]
}))



app.get("/api/trayecto", async (req, res) => {
    TrayectosController.obtenerTrayectos(req, res);
})

app.get("/api/trayecto/search", async (req, res) => {
  TrayectosController.buscarTrayectos(req, res);
});

app.get("/api/trayecto/:id", async (req, res) => {
    TrayectosController.obtenerTrayectoPorId(req, res);
})

app.post("/api/trayecto", async (req, res) => {
    TrayectosController.crearTrayecto(req, res);
})

app.put("/api/trayecto/:id", async (req, res) => {
    TrayectosController.actualizarTrayecto(req, res);
})

app.patch("/api/trayecto/:id", async (req, res) => {
    TrayectosController.patchTrayecto(req, res);
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
app.post("/api/reserva", async (req, res) => {
    // Llama a la función addReserva del controlador de reservas
    ReservaController.addReserva(req, res);
});
app.get("/api/reserva/:travelId", async (req, res) => {
    // Llama a la función deleteReserva del controlador de reservas
    ReservaController.getReservasByTravelId(req, res);
});
app.delete("/api/reserva/:id", async (req, res) => {
    // Llama a la función deleteReserva del controlador de reservas
    ReservaController.deleteReserva(req, res);
});