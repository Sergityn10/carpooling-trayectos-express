import { Router } from "express";
import { AlertasController } from "../controllers/alertas.js";
import { utilsAuthentication } from "../utils/authentication.js";

const alertasRouter = Router();

alertasRouter.use(utilsAuthentication.authenticate);

alertasRouter.post("/", (req, res) => AlertasController.crearAlerta(req, res));
alertasRouter.get("/", (req, res) => AlertasController.obtenerAlertas(req, res));
alertasRouter.patch("/:id/estado", (req, res) =>
  AlertasController.actualizarEstadoAlerta(req, res),
);
alertasRouter.delete("/:id", (req, res) =>
  AlertasController.eliminarAlerta(req, res),
);

export { alertasRouter };
export default alertasRouter;
