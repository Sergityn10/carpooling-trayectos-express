import { AlertaDomainError } from "../Errors/AlertaErrors.js";
import { AlertasService } from "../services/alertas/alertasService.js";

function handleAlertaError(res, error, fallbackMessage) {
  if (error instanceof AlertaDomainError) {
    return res.status(error.statusCode).send({
      status: "Error",
      message: error.message,
    });
  }
  console.error("[AlertasController] Error inesperado:", error);
  return res.status(500).send({
    status: "Error",
    message: fallbackMessage,
  });
}

function getAuthenticatedUserId(req) {
  return req.user?.id ?? req.user?.userId ?? null;
}

function withAuthUser(fallbackMessage, handler) {
  return async (req, res) => {
    const usuarioId = getAuthenticatedUserId(req);
    if (!usuarioId) {
      return res.status(401).send({
        status: "Error",
        message: "No autenticado",
      });
    }
    try {
      return await handler(req, res, usuarioId);
    } catch (error) {
      return handleAlertaError(res, error, fallbackMessage);
    }
  };
}

/**
 * Crea una instancia del controlador de alertas con inyección opcional del servicio.
 */
export function createAlertasController(service = AlertasService) {
  return {
    crearAlerta: withAuthUser(
      "Error interno al crear la alerta",
      async (req, res, usuarioId) => {
        const alerta = await service.createAlerta(usuarioId, req.body);
        return res.status(201).send({
          status: "Success",
          message: "Alerta creada correctamente",
          alerta,
        });
      },
    ),

    obtenerAlertas: withAuthUser(
      "Error interno al obtener las alertas",
      async (req, res, usuarioId) => {
        const alertas = await service.getAlertasByUsuario(usuarioId);
        return res.status(200).send({
          status: "Success",
          alertas,
        });
      },
    ),

    actualizarEstadoAlerta: withAuthUser(
      "Error interno al actualizar el estado de la alerta",
      async (req, res, usuarioId) => {
        const { activa } = req.body ?? {};
        const alerta = await service.updateAlertaEstado(
          req.params.id,
          usuarioId,
          activa,
        );
        return res.status(200).send({
          status: "Success",
          message: "Estado de la alerta actualizado correctamente",
          alerta,
        });
      },
    ),

    eliminarAlerta: withAuthUser(
      "Error interno al eliminar la alerta",
      async (req, res, usuarioId) => {
        await service.deleteAlerta(req.params.id, usuarioId);
        return res.status(200).send({
          status: "Success",
          message: "Alerta eliminada correctamente",
        });
      },
    ),
  };
}

export const AlertasController = createAlertasController();
