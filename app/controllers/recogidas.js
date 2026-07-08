import { randomUUID } from "crypto";
import { prisma } from "../database.js";
import { EventoTrayectoSchema } from "../schemas/recogida.js";

async function crearRecogida(req, res) {
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

  const validation = EventoTrayectoSchema.validateEventoTrayecto(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const { lat, lng, tipo_evento, id_reserva } = validation.data;

  if (tipo_evento === "recogida" && !id_reserva) {
    return res.status(400).send({
      status: "Error",
      message: "id_reserva es obligatorio para eventos de tipo 'recogida'",
    });
  }

  const tipoEvento = await prisma.tipoEvento.findUnique({
    where: { nombre: tipo_evento },
  });
  if (!tipoEvento) {
    return res
      .status(400)
      .send({ status: "Error", message: "Tipo de evento no válido" });
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

  let reservaId = id_reserva;

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
    reservaId = reserva.id_reserva;
  }

  try {
    const evento = await prisma.eventoTrayecto.create({
      data: {
        id: randomUUID(),
        id_trayecto: trayectoId,
        id_reserva: reservaId,
        user_id: userId,
        id_tipo_evento: tipoEvento.id,
        lat,
        lng,
      },
      include: {
        TipoEvento: { select: { id: true, nombre: true } },
      },
    });

    return res.status(201).send({
      status: "Success",
      message: "Evento de trayecto guardado correctamente",
      evento: {
        id: evento.id,
        id_trayecto: evento.id_trayecto,
        id_reserva: evento.id_reserva,
        user_id: evento.user_id,
        id_tipo_evento: evento.id_tipo_evento,
        tipo_evento: evento.TipoEvento,
        lat: evento.lat,
        lng: evento.lng,
        created_at: evento.created_at,
      },
    });
  } catch (error) {
    console.error("Error al guardar evento de trayecto:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al guardar el evento de trayecto",
    });
  }
}

async function obtenerRecogidas(req, res) {
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

  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: trayectoId },
    orderBy: { created_at: "asc" },
    include: {
      TipoEvento: { select: { id: true, nombre: true } },
    },
  });

  return res.status(200).json({
    status: "Success",
    eventos: eventos.map((e) => ({
      id: e.id,
      id_trayecto: e.id_trayecto,
      id_reserva: e.id_reserva,
      user_id: e.user_id,
      id_tipo_evento: e.id_tipo_evento,
      tipo_evento: e.TipoEvento,
      lat: e.lat,
      lng: e.lng,
      created_at: e.created_at,
    })),
  });
}

async function obtenerRecogidaPorUsuario(req, res) {
  const { id: trayectoId, idUser } = req.params;
  if (!trayectoId || trayectoId === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }
  if (!idUser || idUser === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de usuario inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: { id: true, conductor: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const isConductor = String(trayecto.conductor) === String(userId);
  const isOwnRequest = String(idUser) === String(userId);

  if (req.user.role !== "admin" && !isConductor && !isOwnRequest) {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para ver esta información",
    });
  }

  const eventos = await prisma.eventoTrayecto.findMany({
    where: { id_trayecto: trayectoId, user_id: idUser },
    orderBy: { created_at: "asc" },
    include: {
      TipoEvento: { select: { id: true, nombre: true } },
    },
  });

  if (eventos.length === 0) {
    return res.status(404).send({
      status: "Error",
      message: "No se encontraron eventos para este usuario",
    });
  }

  return res.status(200).json({
    status: "Success",
    eventos: eventos.map((e) => ({
      id: e.id,
      id_trayecto: e.id_trayecto,
      id_reserva: e.id_reserva,
      user_id: e.user_id,
      id_tipo_evento: e.id_tipo_evento,
      tipo_evento: e.TipoEvento,
      lat: e.lat,
      lng: e.lng,
      created_at: e.created_at,
    })),
  });
}

async function eliminarRecogida(req, res) {
  const { id: trayectoId, idUser } = req.params;
  if (!trayectoId || trayectoId === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de trayecto inválido" });
  }
  if (!idUser || idUser === "undefined") {
    return res
      .status(400)
      .send({ status: "Error", message: "id de usuario inválido" });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: { id: true, conductor: true },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const isConductor = String(trayecto.conductor) === String(userId);
  const isOwnRequest = String(idUser) === String(userId);

  if (req.user.role !== "admin" && !isConductor && !isOwnRequest) {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para eliminar este evento",
    });
  }

  try {
    const result = await prisma.eventoTrayecto.deleteMany({
      where: { id_trayecto: trayectoId, user_id: idUser },
    });
    if (result.count === 0) {
      return res.status(404).send({
        status: "Error",
        message: "No se encontraron eventos para eliminar",
      });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error("Error al eliminar eventos:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al eliminar los eventos",
    });
  }
}

async function registrarLlegadaDestino(req, res) {
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

  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res
      .status(400)
      .send({ status: "Error", message: "lat y lng son obligatorios" });
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

  if (String(trayecto.conductor) === String(userId)) {
    return res.status(403).send({
      status: "Error",
      message: "El conductor no puede registrar llegada a destino",
    });
  }

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
      message: "No tienes una reserva activa en este trayecto",
    });
  }

  const tipoEventoRecogida = await prisma.tipoEvento.findUnique({
    where: { nombre: "recogida" },
  });
  if (!tipoEventoRecogida) {
    return res
      .status(500)
      .send({
        status: "Error",
        message: "Tipo de evento 'recogida' no encontrado",
      });
  }

  const eventoRecogida = await prisma.eventoTrayecto.findFirst({
    where: {
      id_trayecto: trayectoId,
      id_reserva: reserva.id_reserva,
      id_tipo_evento: tipoEventoRecogida.id,
    },
  });
  if (!eventoRecogida) {
    return res.status(409).send({
      status: "Error",
      message:
        "No se puede registrar la llegada: el pasajero no ha sido recogido",
    });
  }

  const tipoEventoLlegada = await prisma.tipoEvento.findUnique({
    where: { nombre: "llegada_destino" },
  });
  if (!tipoEventoLlegada) {
    return res
      .status(500)
      .send({
        status: "Error",
        message: "Tipo de evento 'llegada_destino' no encontrado",
      });
  }

  const llegadaExistente = await prisma.eventoTrayecto.findFirst({
    where: {
      id_trayecto: trayectoId,
      id_reserva: reserva.id_reserva,
      id_tipo_evento: tipoEventoLlegada.id,
    },
  });
  if (llegadaExistente) {
    return res.status(409).send({
      status: "Error",
      message: "Ya se ha registrado la llegada a destino para esta reserva",
    });
  }

  try {
    const evento = await prisma.eventoTrayecto.create({
      data: {
        id: randomUUID(),
        id_trayecto: trayectoId,
        id_reserva: reserva.id_reserva,
        user_id: userId,
        id_tipo_evento: tipoEventoLlegada.id,
        lat: Number(lat),
        lng: Number(lng),
      },
      include: {
        TipoEvento: { select: { id: true, nombre: true } },
      },
    });

    return res.status(201).send({
      status: "Success",
      message: "Llegada a destino registrada correctamente",
      evento: {
        id: evento.id,
        id_trayecto: evento.id_trayecto,
        id_reserva: evento.id_reserva,
        user_id: evento.user_id,
        tipo_evento: evento.TipoEvento,
        lat: evento.lat,
        lng: evento.lng,
        created_at: evento.created_at,
      },
    });
  } catch (error) {
    console.error("Error al registrar llegada a destino:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al registrar la llegada a destino",
    });
  }
}

export const RecogidasController = {
  crearRecogida,
  obtenerRecogidas,
  obtenerRecogidaPorUsuario,
  eliminarRecogida,
  registrarLlegadaDestino,
};
