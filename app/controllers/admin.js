import { prisma } from "../database.js";
import { PaginationUtils } from "../utils/pagination.js";
import { UsersAPI } from "../utils/users-api.js";

// =================== RESERVAS ===================

async function adminGetAllReservas(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { status, user_id, id_trayecto, trip_outcome } = req.query;

  const where = {
    ...(status && { status }),
    ...(user_id && { user_id }),
    ...(id_trayecto && { id_trayecto }),
    ...(trip_outcome && { trip_outcome }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "desc";

  try {
    const [reservas, total] = await Promise.all([
      prisma.reserva.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.reserva.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: reservas,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllReservas] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminGetReservaById(req, res) {
  const { id } = req.params;
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id_reserva: id },
      include: { Trayecto: true },
    });

    if (!reserva) {
      return res.status(404).send({ status: "Error", message: "Reserva no encontrada" });
    }

    return res.status(200).json({ status: "Success", data: reserva });
  } catch (error) {
    console.error("[adminGetReservaById] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminUpdateReserva(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.reserva.findUnique({ where: { id_reserva: id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Reserva no encontrada" });
    }

    const allowedFields = [
      "status",
      "trip_outcome",
      "trip_outcome_reason",
      "trip_outcome_at",
      "stripe_payment_intent_status",
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ status: "Error", message: "No hay campos para actualizar" });
    }

    if (updateData.trip_outcome_at) {
      updateData.trip_outcome_at = new Date(updateData.trip_outcome_at);
    }

    const updated = await prisma.reserva.update({
      where: { id_reserva: id },
      data: updateData,
    });

    return res.status(200).json({ status: "Success", data: updated });
  } catch (error) {
    console.error("[adminUpdateReserva] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteReserva(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.reserva.findUnique({ where: { id_reserva: id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Reserva no encontrada" });
    }

    await prisma.reserva.delete({ where: { id_reserva: id } });
    return res.status(200).json({ status: "Success", message: "Reserva eliminada correctamente" });
  } catch (error) {
    console.error("[adminDeleteReserva] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== COMMENTS ===================

async function adminGetAllComments(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { user_id_commentator, user_id_trayect, id_trayecto } = req.query;

  const where = {
    ...(user_id_commentator && { user_id_commentator }),
    ...(user_id_trayect && { user_id_trayect }),
    ...(id_trayecto && { id_trayecto }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "desc";

  try {
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.comment.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: comments,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllComments] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminGetCommentById(req, res) {
  const { id } = req.params;
  try {
    const comment = await prisma.comment.findUnique({ where: { id_comment: id } });
    if (!comment) {
      return res.status(404).send({ status: "Error", message: "Comentario no encontrado" });
    }
    return res.status(200).json({ status: "Success", data: comment });
  } catch (error) {
    console.error("[adminGetCommentById] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminUpdateComment(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.comment.findUnique({ where: { id_comment: id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Comentario no encontrado" });
    }

    const allowedFields = ["opinion", "rating"];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ status: "Error", message: "No hay campos para actualizar" });
    }

    const updated = await prisma.comment.update({
      where: { id_comment: id },
      data: updateData,
    });

    return res.status(200).json({ status: "Success", data: updated });
  } catch (error) {
    console.error("[adminUpdateComment] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteComment(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.comment.findUnique({ where: { id_comment: id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Comentario no encontrado" });
    }

    await prisma.comment.delete({ where: { id_comment: id } });
    return res.status(200).json({ status: "Success", message: "Comentario eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeleteComment] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== PAGOS ===================

async function adminGetAllPagos(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { user_id, id_trayecto, payment_status } = req.query;

  const where = {
    ...(user_id && { user_id }),
    ...(id_trayecto && { id_trayecto }),
    ...(payment_status && { payment_status }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "desc";

  try {
    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.pago.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: pagos,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllPagos] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminGetPagoById(req, res) {
  const { id } = req.params;
  try {
    const pago = await prisma.pago.findUnique({ where: { id: parseInt(id) } });
    if (!pago) {
      return res.status(404).send({ status: "Error", message: "Pago no encontrado" });
    }
    return res.status(200).json({ status: "Success", data: pago });
  } catch (error) {
    console.error("[adminGetPagoById] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeletePago(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.pago.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Pago no encontrado" });
    }

    await prisma.pago.delete({ where: { id: parseInt(id) } });
    return res.status(200).json({ status: "Success", message: "Pago eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeletePago] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== RECORRIDOS ===================

async function adminGetAllRecorridos(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { id_trayecto, user_id } = req.query;

  const where = {
    ...(id_trayecto && { id_trayecto }),
    ...(user_id && { user_id }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "asc";

  try {
    const [recorridos, total] = await Promise.all([
      prisma.recorrido.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.recorrido.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: recorridos,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllRecorridos] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteRecorrido(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.recorrido.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Recorrido no encontrado" });
    }

    await prisma.recorrido.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "Recorrido eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeleteRecorrido] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteRecorridosByTrayecto(req, res) {
  const { id_trayecto } = req.params;
  try {
    const result = await prisma.recorrido.deleteMany({ where: { id_trayecto } });
    return res.status(200).json({
      status: "Success",
      message: `${result.count} puntos de recorrido eliminados`,
    });
  } catch (error) {
    console.error("[adminDeleteRecorridosByTrayecto] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== EVENTOS TRAYECTO ===================

async function adminGetAllEventos(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { id_trayecto, user_id, id_tipo_evento } = req.query;

  const where = {
    ...(id_trayecto && { id_trayecto }),
    ...(user_id && { user_id }),
    ...(id_tipo_evento && { id_tipo_evento: parseInt(id_tipo_evento) }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "asc";

  try {
    const [eventos, total] = await Promise.all([
      prisma.eventoTrayecto.findMany({
        where,
        include: { TipoEvento: { select: { nombre: true } } },
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.eventoTrayecto.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: eventos,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllEventos] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteEvento(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.eventoTrayecto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Evento no encontrado" });
    }

    await prisma.eventoTrayecto.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "Evento eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeleteEvento] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteEventosByTrayecto(req, res) {
  const { id_trayecto } = req.params;
  try {
    const result = await prisma.eventoTrayecto.deleteMany({ where: { id_trayecto } });
    return res.status(200).json({
      status: "Success",
      message: `${result.count} eventos eliminados`,
    });
  } catch (error) {
    console.error("[adminDeleteEventosByTrayecto] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== TRAMOS ===================

async function adminGetAllTramos(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { id_trayecto } = req.query;

  const where = {
    ...(id_trayecto && { id_trayecto }),
  };

  const orderBy = req.query.orderBy || "step_order";
  const order = req.query.order || "asc";

  try {
    const [tramos, total] = await Promise.all([
      prisma.tramo.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.tramo.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: tramos,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllTramos] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteTramo(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.tramo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Tramo no encontrado" });
    }

    await prisma.tramo.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "Tramo eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeleteTramo] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteTramosByTrayecto(req, res) {
  const { id_trayecto } = req.params;
  try {
    const result = await prisma.tramo.deleteMany({ where: { id_trayecto } });
    return res.status(200).json({
      status: "Success",
      message: `${result.count} tramos eliminados`,
    });
  } catch (error) {
    console.error("[adminDeleteTramosByTrayecto] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== UBICACIONES ===================

async function adminGetAllUbicaciones(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { user_id } = req.query;

  const where = {
    ...(user_id && { user_id }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "desc";

  try {
    const [ubicaciones, total] = await Promise.all([
      prisma.ubicacion.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.ubicacion.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: ubicaciones,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllUbicaciones] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteUbicacion(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.ubicacion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Ubicación no encontrada" });
    }

    await prisma.ubicacion.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "Ubicación eliminada correctamente" });
  } catch (error) {
    console.error("[adminDeleteUbicacion] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== FREQUENT ROUTES ===================

async function adminGetAllFrequentRoutes(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { user_id, role } = req.query;

  const where = {
    ...(user_id && { user_id }),
    ...(role && { role }),
  };

  const orderBy = req.query.orderBy || "createdAt";
  const order = req.query.order || "desc";

  try {
    const [routes, total] = await Promise.all([
      prisma.frequentRoute.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.frequentRoute.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: routes,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllFrequentRoutes] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteFrequentRoute(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.frequentRoute.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "Ruta frecuente no encontrada" });
    }

    await prisma.frequentRoute.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "Ruta frecuente eliminada correctamente" });
  } catch (error) {
    console.error("[adminDeleteFrequentRoute] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

// =================== INFO CAEs ===================

async function adminGetAllInfoCAEs(req, res) {
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);
  const { status, id_trayecto } = req.query;

  let statusId = undefined;
  if (status) {
    const statusRecord = await prisma.statusInfoCAEs.findUnique({ where: { name: status } });
    if (statusRecord) statusId = statusRecord.id;
  }

  const where = {
    ...(statusId && { status_id: statusId }),
    ...(id_trayecto && { id_trayecto }),
  };

  const orderBy = req.query.orderBy || "created_at";
  const order = req.query.order || "desc";

  try {
    const [caes, total] = await Promise.all([
      prisma.infoCAEs.findMany({
        where,
        include: { StatusInfoCAEs: true },
        skip: offset,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      prisma.infoCAEs.count({ where }),
    ]);

    return res.status(200).json({
      status: "Success",
      data: caes,
      pagination: PaginationUtils.buildPaginationResponse({ page, limit, total }),
    });
  } catch (error) {
    console.error("[adminGetAllInfoCAEs] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminUpdateInfoCAE(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.infoCAEs.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "InfoCAE no encontrado" });
    }

    const allowedFields = [
      "km_recorridos",
      "km_with_company",
      "kwh_generated",
      "eur_generated",
      "status_id",
      "report_id",
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ status: "Error", message: "No hay campos para actualizar" });
    }

    const updated = await prisma.infoCAEs.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({ status: "Success", data: updated });
  } catch (error) {
    console.error("[adminUpdateInfoCAE] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

async function adminDeleteInfoCAE(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.infoCAEs.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).send({ status: "Error", message: "InfoCAE no encontrado" });
    }

    await prisma.infoCAEs.delete({ where: { id } });
    return res.status(200).json({ status: "Success", message: "InfoCAE eliminado correctamente" });
  } catch (error) {
    console.error("[adminDeleteInfoCAE] Error:", error);
    return res.status(500).send({ status: "Error", message: error.message });
  }
}

export const AdminController = {
  // Reservas
  adminGetAllReservas,
  adminGetReservaById,
  adminUpdateReserva,
  adminDeleteReserva,
  // Comments
  adminGetAllComments,
  adminGetCommentById,
  adminUpdateComment,
  adminDeleteComment,
  // Pagos
  adminGetAllPagos,
  adminGetPagoById,
  adminDeletePago,
  // Recorridos
  adminGetAllRecorridos,
  adminDeleteRecorrido,
  adminDeleteRecorridosByTrayecto,
  // Eventos
  adminGetAllEventos,
  adminDeleteEvento,
  adminDeleteEventosByTrayecto,
  // Tramos
  adminGetAllTramos,
  adminDeleteTramo,
  adminDeleteTramosByTrayecto,
  // Ubicaciones
  adminGetAllUbicaciones,
  adminDeleteUbicacion,
  // Frequent Routes
  adminGetAllFrequentRoutes,
  adminDeleteFrequentRoute,
  // InfoCAEs
  adminGetAllInfoCAEs,
  adminUpdateInfoCAE,
  adminDeleteInfoCAE,
};
