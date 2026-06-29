import { randomUUID } from "crypto";
import { database } from "../database.js";

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

  const connection = await database.getConnection();

  const [trayectos] = await connection.query(
    "SELECT id, conductor, status FROM trayectos WHERE id = ?",
    [trayectoId],
  );
  const trayecto = trayectos?.[0];
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
    const [reservas] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_trayecto = ? AND user_id = ? AND status != 'canceled'",
      [trayectoId, userId],
    );
    if (!reservas || reservas.length === 0) {
      return res.status(403).send({
        status: "Error",
        message: "No formas parte de este trayecto",
      });
    }
  }

  const id = randomUUID();
  await connection.query(
    "INSERT INTO recorridos (id, id_trayecto, user_id, lat, lng, address) VALUES (?, ?, ?, ?, ?, ?)",
    [id, trayectoId, userId, lat, lng, address],
  );

  return res.status(201).send({
    status: "Success",
    message: "Ubicación guardada correctamente",
    recorrido: {
      id,
      id_trayecto: trayectoId,
      user_id: userId,
      lat,
      lng,
      address,
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

  const connection = await database.getConnection();

  const [trayectos] = await connection.query(
    "SELECT id, conductor, status FROM trayectos WHERE id = ?",
    [trayectoId],
  );
  const trayecto = trayectos?.[0];
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const isConductor = String(trayecto.conductor) === String(userId);

  if (!isConductor) {
    const [reservas] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_trayecto = ? AND user_id = ? AND status != 'canceled'",
      [trayectoId, userId],
    );
    if (!reservas || reservas.length === 0) {
      return res.status(403).send({
        status: "Error",
        message: "No formas parte de este trayecto",
      });
    }
  }

  const [rows] = await connection.query(
    "SELECT id, id_trayecto, user_id, lat, lng, address, created_at FROM recorridos WHERE id_trayecto = ? ORDER BY created_at ASC",
    [trayectoId],
  );

  return res.status(200).json({
    status: "Success",
    recorridos: rows,
  });
}

export const RecorridosController = {
  guardarUbicacion,
  obtenerRecorrido,
};
