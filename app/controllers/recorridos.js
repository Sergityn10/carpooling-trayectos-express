import { randomUUID } from "crypto";
import { prisma } from "../database.js";

async function guardarUbicacion(req, res) {
  const { id: trayectoId } = req.params;
  if (!trayectoId || trayectoId === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const { lat, lng, address } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).send({
      status: "Error",
      message: "lat y lng son obligatorios y deben ser números",
    });
  }
  if (!address || typeof address !== "string") {
    return res.status(400).send({
      status: "Error",
      message: "address es obligatorio",
    });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: { id: true, conductor: true, status: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(trayecto.status).toLowerCase() !== "en curso") {
    return res.status(409).send({
      status: "Error",
      message: "El trayecto no está en curso",
    });
  }

  const isConductor = String(trayecto.conductor) === String(userId);

  if (!isConductor) {
    const reserva = await prisma.reserva.findFirst({
      where: {
        id_trayecto: trayectoId,
        user_id: userId,
        NOT: { status: "canceled" },
      },
      select: { id_reserva: true },
    });
    if (!reserva) {
      return res.status(403).send({
        status: "Error",
        message: "No formas parte de este trayecto",
      });
    }
  }

  const id = randomUUID();
  const recorrido = await prisma.recorrido.create({
    data: {
      id,
      id_trayecto: trayectoId,
      user_id: userId,
      lat,
      lng,
      address,
    },
  });

  return res.status(201).send({
    status: "Success",
    message: "Ubicación guardada correctamente",
    recorrido: {
      id: recorrido.id,
      id_trayecto: recorrido.id_trayecto,
      user_id: recorrido.user_id,
      lat: recorrido.lat,
      lng: recorrido.lng,
      address: recorrido.address,
    },
  });
}

async function obtenerRecorrido(req, res) {
  const { id: trayectoId } = req.params;
  if (!trayectoId || trayectoId === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: { id: true, conductor: true, status: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const isConductor = String(trayecto.conductor) === String(userId);

  if (req.user.role !== "admin" && !isConductor) {
    const reserva = await prisma.reserva.findFirst({
      where: {
        id_trayecto: trayectoId,
        user_id: userId,
        NOT: { status: "canceled" },
      },
      select: { id_reserva: true },
    });
    if (!reserva) {
      return res.status(403).send({
        status: "Error",
        message: "No formas parte de este trayecto",
      });
    }
  }

  const recorridos = await prisma.recorrido.findMany({
    where: { id_trayecto: trayectoId },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      id_trayecto: true,
      user_id: true,
      lat: true,
      lng: true,
      address: true,
      created_at: true,
    },
  });

  return res.status(200).json({
    status: "Success",
    recorridos,
  });
}

export const RecorridosController = {
  guardarUbicacion,
  obtenerRecorrido,
};
