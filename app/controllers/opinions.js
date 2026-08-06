import { randomUUID } from "crypto";

import { ComentarioSchema } from "../schemas/opinions.js";

import { database } from "../database.js";
import { PaginationUtils } from "../utils/pagination.js";

const tableName = "comments";

async function addOpinion(req, res) {
  const validation = ComentarioSchema.validateComentarioSinId(req.body);

  if (!validation.success) {
    return res

      .status(400)

      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const { user_id_commentator, user_id_trayect, trayecto_id, opinion, rating } =
    validation.data;

  if (req.user?.id && String(req.user.id) !== String(user_id_commentator)) {
    return res.status(401).send({
      status: "Error",

      message:
        "No tienes permiso para crear una opinión en nombre de otro usuario",
    });
  }

  try {
    const connection = await database.getConnection();

    // Validar que el trayecto exista (opcional, mejora el mensaje de error)

    const [trayectoRows] = await connection.query(
      "SELECT id, conductor FROM trayectos WHERE id = ?",

      [trayecto_id],
    );

    if (trayectoRows.length === 0) {
      return res

        .status(404)

        .send({ status: "Error", message: "Trayecto no encontrado" });
    }

    const trayecto = trayectoRows[0];

    const isConductor = String(trayecto.conductor) === String(req.user.id);

    const [reservaRows] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE user_id = ? AND id_trayecto = ? AND status = 'completed' LIMIT 1",

      [String(user_id_commentator), trayecto_id],
    );

    const isPasajero = Array.isArray(reservaRows) && reservaRows.length > 0;

    if (!isPasajero && !isConductor) {
      return res.status(403).send({
        status: "Error",

        message:
          "Para opinar debes haber realizado una reserva (pagada) de este trayecto",
      });
    }

    if (isConductor) {
      const [pasajeroReservaRows] = await connection.query(
        "SELECT id_reserva FROM reservas WHERE user_id = ? AND id_trayecto = ? AND status = 'completed' LIMIT 1",

        [String(user_id_trayect), trayecto_id],
      );

      if (!pasajeroReservaRows || pasajeroReservaRows.length === 0) {
        return res.status(403).send({
          status: "Error",

          message: "El pasajero no pertenece a este trayecto",
        });
      }
    }

    const commentId = randomUUID();

    let result;

    try {
      [result] = await connection.query(
        `INSERT INTO ${tableName} (id_comment, user_id_commentator, user_id_trayect, id_trayecto, opinion, rating) VALUES (?, ?, ?, ?, ?, ?)`,

        [
          commentId,

          user_id_commentator,

          user_id_trayect,

          trayecto_id,

          opinion,

          rating,
        ],
      );
    } catch (error) {
      switch (error.code) {
        case "ER_NO_REFERENCED_ROW_2":
          return res.status(400).send({
            status: "Error",

            message: "El usuario o trayecto no existen",
          });

        case "ER_DUP_ENTRY":
          return res.status(400).send({
            status: "Error",

            message:
              "La opinión ya existe o el usuario ya ha opinado para este trayecto",
          });

        default:
          return res

            .status(500)

            .send({ status: "Error", message: "Error al crear la opinión" });
      }
    }

    if (!result || result.affectedRows === 0) {
      return res

        .status(500)

        .send({ status: "Error", message: "No se pudo crear la opinión" });
    }

    const newOpinion = {
      id: commentId,

      user_id_commentator,

      user_id_trayect,

      trayecto_id,

      opinion,

      rating,
    };

    return res.status(201).send({
      status: "Success",

      message: "Opinión creada correctamente",

      opinion: newOpinion,
    });
  } catch (error) {
    console.error("Error en addOpinion:", error);

    return res.status(500).send({
      status: "Error",

      message: "Error en el servidor al crear la opinión",
    });
  }
}

async function getOpinionByUserIdCommentator(req, res) {
  const { userId } = req.params;
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);

  try {
    const connection = await database.getConnection();

    let opinionList = await connection.query(
      `SELECT * FROM ${tableName} WHERE user_id_commentator = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    opinionList = opinionList[0];

    let countResult = await connection.query(
      `SELECT COUNT(*) as total FROM ${tableName} WHERE user_id_commentator = ?`,
      [userId],
    );
    const total = Number(countResult[0]?.[0]?.total ?? 0);

    return res.status(200).send({
      status: "Success",
      data: opinionList,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en getOpinionByUserIdCommentator:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener opiniones",
    });
  }
}

async function getOpinionByUserIdTrayect(req, res) {
  const { userId } = req.params;
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);

  try {
    const connection = await database.getConnection();

    let opinionList = await connection.query(
      `SELECT * FROM ${tableName} WHERE user_id_trayect = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    opinionList = opinionList[0];

    let countResult = await connection.query(
      `SELECT COUNT(*) as total FROM ${tableName} WHERE user_id_trayect = ?`,
      [userId],
    );
    const total = Number(countResult[0]?.[0]?.total ?? 0);

    return res.status(200).send({
      status: "Success",
      data: opinionList,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en getOpinionByUserIdTrayect:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error en el servidor al obtener opiniones",
    });
  }
}

async function getOpinionsByTravelId(req, res) {
  const { travelId } = req.params;

  try {
    const connection = await database.getConnection();

    let opinionsList = await connection.query(
      `SELECT * FROM ${tableName} WHERE id_trayecto = ?`,

      [travelId],
    );

    if (opinionsList[0].length === 0) {
      return res.status(404).send({
        status: "Error",

        message: `No se han encontrado opiniones para este trayecto o el trayecto no existe con id ${travelId}`,
      });
    }

    opinionsList = opinionsList[0];

    return res.status(200).send({
      status: "Success",

      opinionsList,
    });
  } catch (error) {
    console.error("Error en getOpinionsByTravelId:", error);

    return res.status(500).send({
      status: "Error",

      message: "Error en el servidor al obtener opiniones",
    });
  }
}

async function patchComment(req, res) {
  let { id } = req.params;

  id = String(id);

  console.log("Id de la opinión a actualizar:", id);

  const validation = ComentarioSchema.validateComentarioUpdate(req.body);

  if (!validation.success) {
    return res

      .status(400)

      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const { opinion, rating, id_comment } = validation.data;

  if (String(id_comment) !== String(id)) {
    return res.status(400).send({
      status: "Error",

      message:
        "El id de la opinión no coincide con el id de la opinión a actualizar",
    });
  }

  const connection = await database.getConnection();

  const [result] = await connection.query(
    `UPDATE ${tableName} SET opinion = ?, rating = ? WHERE id_comment = ?`,

    [opinion, rating, id_comment],
  );

  if (result.affectedRows === 0) {
    return res.status(404).send({
      status: "Error",

      message: `Opinión no encontrada o la opinión no existe con id ${id_comment}`,
    });
  }

  let updatedOpinion = await connection.query(
    `SELECT * FROM ${tableName} WHERE id_comment = ?`,

    [id_comment],
  );

  updatedOpinion = updatedOpinion[0][0];

  return res.status(200).send({
    status: "Success",

    message: "Opinión actualizada correctamente",

    updatedOpinion,
  });
}

async function deleteOpinion(req, res) {
  const { id } = req.params;

  try {
    const connection = await database.getConnection();

    const [result] = await connection.query(
      `DELETE FROM ${tableName} WHERE id_comment = ?`,

      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({
        status: "Error",

        message: `Opinión no encontrada o la opinión no existe con id ${id}`,
      });
    }

    return res

      .status(200)

      .send({ status: "Success", message: "Opinión eliminada correctamente" });
  } catch (error) {
    console.error("Error en deleteOpinion:", error);

    return res.status(500).send({
      status: "Error",

      message: "Error en el servidor al eliminar la opinión",
    });
  }
}

export const OpinionsController = {
  addOpinion,

  deleteOpinion,

  getOpinionsByTravelId,

  getOpinionByUserIdCommentator,

  getOpinionByUserIdTrayect,

  patchComment,
};
