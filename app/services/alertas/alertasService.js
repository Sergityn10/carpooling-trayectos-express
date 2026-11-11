import { prisma } from "../../database.js";
import {
  AlertaForbiddenError,
  AlertaNotFoundError,
  AlertaValidationError,
} from "../../Errors/AlertaErrors.js";
import { AlertaFactory } from "./alertaFactory.js";

function parseAlertaId(rawId) {
  const str = rawId == null ? "" : String(rawId).trim();
  if (!/^\d+$/.test(str)) {
    throw new AlertaValidationError("El ID de la alerta debe ser un entero positivo");
  }
  const id = Number(str);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AlertaValidationError("El ID de la alerta debe ser un entero positivo");
  }
  return id;
}

async function findOwnedAlertaOrThrow(alertaId, usuarioId, prismaClient) {
  const alerta = await prismaClient.alertaTrayecto.findUnique({
    where: { id: alertaId },
  });

  if (!alerta) {
    throw new AlertaNotFoundError("Alerta no encontrada");
  }

  if (String(alerta.usuarioId) !== String(usuarioId)) {
    throw new AlertaForbiddenError(
      "No tienes permiso para acceder o modificar esta alerta",
    );
  }

  return alerta;
}

async function createAlerta(usuarioId, body, prismaClient = prisma) {
  const normalizedUserId = usuarioId == null ? "" : String(usuarioId).trim();
  if (!normalizedUserId) {
    throw new AlertaValidationError("El identificador de usuario es obligatorio");
  }

  const stiData = AlertaFactory.createPayload(body);

  return prismaClient.alertaTrayecto.create({
    data: {
      usuarioId: normalizedUserId,
      ...stiData,
      activa: true,
    },
  });
}

async function getAlertasByUsuario(usuarioId, prismaClient = prisma) {
  const normalizedUserId = usuarioId == null ? "" : String(usuarioId).trim();
  if (!normalizedUserId) {
    throw new AlertaValidationError("El identificador de usuario es obligatorio");
  }

  return prismaClient.alertaTrayecto.findMany({
    where: { usuarioId: normalizedUserId },
    orderBy: { createdAt: "desc" },
  });
}

async function updateAlertaEstado(rawId, usuarioId, activa, prismaClient = prisma) {
  const alertaId = parseAlertaId(rawId);

  if (typeof activa !== "boolean") {
    throw new AlertaValidationError(
      "El campo 'activa' es obligatorio y debe ser booleano",
    );
  }

  await findOwnedAlertaOrThrow(alertaId, usuarioId, prismaClient);

  return prismaClient.alertaTrayecto.update({
    where: { id: alertaId },
    data: { activa },
  });
}

async function deleteAlerta(rawId, usuarioId, prismaClient = prisma) {
  const alertaId = parseAlertaId(rawId);
  await findOwnedAlertaOrThrow(alertaId, usuarioId, prismaClient);

  await prismaClient.alertaTrayecto.delete({
    where: { id: alertaId },
  });
}

export const AlertasService = {
  createAlerta,
  getAlertasByUsuario,
  updateAlertaEstado,
  deleteAlerta,
};
