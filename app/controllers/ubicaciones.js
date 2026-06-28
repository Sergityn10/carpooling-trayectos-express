import { randomUUID } from "crypto";
import { database } from "../database.js";
import { UbicacionMethods } from "../schemas/ubicacion.js";

const tableName = "ubicaciones";

async function crearUbicacion(req, res) {
  const validation = UbicacionMethods.validateUbicacionSinId(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const data = { ...validation.data };
  if (req.user?.userId) data.userId = req.user.userId;

  const {
    lat,
    lng,
    display_name,
    address,
    city,
    province,
    country,
    postal_code,
    type,
    userId,
  } = data;

  try {
    const connection = await database.getConnection();
    const ubicacionId = randomUUID();
    let result;
    try {
      [result] = await connection.query(
        `INSERT INTO ${tableName} (id, lat, lng, display_name, address, city, province, country, postal_code, type, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ubicacionId,
          lat,
          lng,
          display_name,
          address,
          city ?? null,
          province ?? null,
          country ?? null,
          postal_code ?? null,
          type ?? null,
          userId,
        ],
      );
    } catch (error) {
      switch (error.code) {
        case "ER_DUP_ENTRY":
          return res.status(400).send({
            status: "Error",
            message:
              "La ubicación ya existe para este usuario o la dirección ya está registrada",
          });
        default:
          return res
            .status(500)
            .send({ status: "Error", message: "Error al crear la ubicación" });
      }
    }

    if (!result || result.affectedRows === 0) {
      return res
        .status(500)
        .send({ status: "Error", message: "No se pudo crear la ubicación" });
    }

    return res.status(201).send({
      status: "Success",
      message: "Ubicación creada correctamente",
      ubicacion: {
        id: ubicacionId,
        lat,
        lng,
        display_name,
        address,
        city: city ?? null,
        province: province ?? null,
        country: country ?? null,
        postal_code: postal_code ?? null,
        type: type ?? null,
        userId,
      },
    });
  } catch (error) {
    console.error("Error en crearUbicacion:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al crear la ubicación",
    });
  }
}

async function obtenerUbicaciones(req, res) {
  try {
    const connection = await database.getConnection();
    const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error en obtenerUbicaciones:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener ubicaciones",
    });
  }
}

async function obtenerUbicacionPorId(req, res) {
  const { id } = req.params;
  try {
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ubicación no encontrada" });
    }
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error en obtenerUbicacionPorId:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener la ubicación",
    });
  }
}

async function obtenerUbicacionesPorUsuario(req, res) {
  const { userId } = req.user || {};
  const { userIdParam } = req.params;

  if (userIdParam && userId && userId !== userIdParam) {
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para ver las ubicaciones de este usuario",
    });
  }

  try {
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM ${tableName} WHERE user_id = ?`,
      [userIdParam ?? userId],
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error en obtenerUbicacionesPorUsuario:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener ubicaciones",
    });
  }
}

async function actualizarUbicacion(req, res) {
  const { id } = req.params;
  const validation = UbicacionMethods.validateUbicacionPartial(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const data = { ...validation.data };
  delete data.id;
  delete data.userId;

  if (Object.keys(data).length === 0) {
    return res.status(400).send({
      status: "Error",
      message: "No se proporcionaron campos para actualizar.",
    });
  }

  try {
    const connection = await database.getConnection();
    const [found] = await connection.query(
      `SELECT user_id FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (found.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ubicación no encontrada" });
    }
    if (req.user?.id && String(found[0].user_id) !== String(req.user.id)) {
      return res.status(401).send({
        status: "Error",
        message: "No tienes permiso para actualizar esta ubicación",
      });
    }

    const setClauses = [];
    const values = [];
    for (const key in data) {
      setClauses.push(`\`${key}\` = ?`);
      values.push(data[key]);
    }
    const query = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE id = ?`;
    values.push(id);

    const [result] = await connection.query(query, values);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ubicación no encontrada" });
    }
    return res.sendStatus(204);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .send({ status: "Error", message: "La dirección ya existe" });
    }
    console.error("Error en actualizarUbicacion:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al actualizar la ubicación",
    });
  }
}

async function eliminarUbicacion(req, res) {
  const { id } = req.params;
  try {
    const connection = await database.getConnection();
    const [found] = await connection.query(
      `SELECT user_id FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (found.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ubicación no encontrada" });
    }
    if (req.user?.id && String(found[0].user_id) !== String(req.user.id)) {
      return res.status(401).send({
        status: "Error",
        message: "No tienes permiso para eliminar esta ubicación",
      });
    }

    const [result] = await connection.query(
      `DELETE FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ubicación no encontrada" });
    }
    return res.status(200).send({
      status: "Success",
      message: "Ubicación eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en eliminarUbicacion:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al eliminar la ubicación",
    });
  }
}

export const UbicacionesController = {
  crearUbicacion,
  obtenerUbicaciones,
  obtenerUbicacionPorId,
  obtenerUbicacionesPorUsuario,
  actualizarUbicacion,
  eliminarUbicacion,
};
