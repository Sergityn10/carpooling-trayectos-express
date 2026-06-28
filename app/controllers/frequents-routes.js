import { randomUUID } from "crypto";
import { database } from "../database.js";
import { FrequentRoutesSchema } from "../schemas/frequents-routes.js";

const tableName = "frequents_routes";

function getAuthenticatedUserId(req) {
  return req.user?.userId ?? req.user?.id ?? null;
}

async function createFrequentRoute(req, res) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const validation = FrequentRoutesSchema.validateFrequentRouteCreate(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const data = { ...validation.data, user_id: String(userId) };
  const {
    user_id,
    name,
    originAddress,
    originLat,
    originLng,
    destAddress,
    destLat,
    destLng,
    role,
    seats,
  } = data;

  try {
    const connection = await database.getConnection();
    const routeId = randomUUID();
    let result;
    try {
      [result] = await connection.query(
        `INSERT INTO ${tableName} (
          id,
          user_id,
          name,
          originAddress,
          originLat,
          originLng,
          destAddress,
          destLat,
          destLng,
          role,
          seats
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routeId,
          user_id,
          name ?? null,
          originAddress,
          originLat,
          originLng,
          destAddress,
          destLat,
          destLng,
          role ?? "DRIVER",
          seats ?? 1,
        ],
      );
    } catch (error) {
      switch (error.code) {
        case "ER_NO_REFERENCED_ROW_2":
          return res
            .status(400)
            .send({ status: "Error", message: "El usuario no existe" });
        default:
          console.error("Error en createFrequentRoute (insert):", error);
          return res.status(500).send({
            status: "Error",
            message: "Error al crear la ruta frecuente",
          });
      }
    }

    if (!result || result.affectedRows === 0) {
      return res.status(500).send({
        status: "Error",
        message: "No se pudo crear la ruta frecuente",
      });
    }

    return res.status(201).send({
      status: "Success",
      message: "Ruta frecuente creada correctamente",
      frequentRoute: {
        id: routeId,
        user_id,
        name: name ?? null,
        originAddress,
        originLat,
        originLng,
        destAddress,
        destLat,
        destLng,
        role: role ?? "DRIVER",
        seats: seats ?? 1,
      },
    });
  } catch (error) {
    console.error("Error en createFrequentRoute:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al crear la ruta frecuente",
    });
  }
}

async function getMyFrequentRoutes(req, res) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  try {
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY updatedAt DESC, createdAt DESC`,
      [String(userId)],
    );
    return res.status(200).send({ status: "Success", frequentRoutes: rows });
  } catch (error) {
    console.error("Error en getMyFrequentRoutes:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener rutas frecuentes",
    });
  }
}

async function getFrequentRoutesByUser(req, res) {
  const authUserId = getAuthenticatedUserId(req);
  const { userIdParam } = req.params;

  if (!authUserId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  if (userIdParam && String(authUserId) !== String(userIdParam)) {
    return res.status(401).send({
      status: "Error",
      message:
        "No tienes permiso para ver las rutas frecuentes de este usuario",
    });
  }

  req.user = { ...(req.user || {}), userId: userIdParam };
  return getMyFrequentRoutes(req, res);
}

async function getFrequentRouteById(req, res) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const id = String(req.params.id);
  if (!id) {
    return res.status(400).send({ status: "Error", message: "id inválido" });
  }

  try {
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
      [id, String(userId)],
    );
    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }
    return res.status(200).send({ status: "Success", frequentRoute: rows[0] });
  } catch (error) {
    console.error("Error en getFrequentRouteById:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener la ruta frecuente",
    });
  }
}

async function patchFrequentRoute(req, res) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const id = String(req.params.id);
  if (!id) {
    return res.status(400).send({ status: "Error", message: "id inválido" });
  }

  const validation = FrequentRoutesSchema.validateFrequentRoutePartial(
    req.body,
  );
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const data = { ...validation.data };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.user_id;

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
    if (!found || found.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }

    if (String(found[0].user_id) !== String(userId)) {
      return res.status(401).send({
        status: "Error",
        message: "No tienes permiso para actualizar esta ruta frecuente",
      });
    }

    const setClauses = [];
    const values = [];

    for (const key in data) {
      setClauses.push(`\`${key}\` = ?`);
      values.push(data[key]);
    }

    setClauses.push("updatedAt = datetime('now')");

    const query = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE id = ?`;
    values.push(id);

    const [result] = await connection.query(query, values);
    if (!result || result.affectedRows === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Error en patchFrequentRoute:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al actualizar la ruta frecuente",
    });
  }
}

async function deleteFrequentRoute(req, res) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  const id = String(req.params.id);
  if (!id) {
    return res.status(400).send({ status: "Error", message: "id inválido" });
  }

  try {
    const connection = await database.getConnection();
    const [found] = await connection.query(
      `SELECT user_id FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (!found || found.length === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }

    if (String(found[0].user_id) !== String(userId)) {
      return res.status(401).send({
        status: "Error",
        message: "No tienes permiso para eliminar esta ruta frecuente",
      });
    }

    const [result] = await connection.query(
      `DELETE FROM ${tableName} WHERE id = ?`,
      [id],
    );
    if (!result || result.affectedRows === 0) {
      return res
        .status(404)
        .send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }

    return res.status(200).send({
      status: "Success",
      message: "Ruta frecuente eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en deleteFrequentRoute:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al eliminar la ruta frecuente",
    });
  }
}

export const FrequentRoutesController = {
  createFrequentRoute,
  getMyFrequentRoutes,
  getFrequentRoutesByUser,
  getFrequentRouteById,
  patchFrequentRoute,
  deleteFrequentRoute,
};
