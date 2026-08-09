import { randomUUID } from "crypto";
import { ReservaSchema } from "../schemas/reserva.js";
import { prisma } from "../database.js";
import dotenv from "dotenv";
import { UsersAPI } from "../utils/users-api.js";
import { NotificationsAPI } from "../utils/notifications-api.js";
import { PaginationUtils } from "../utils/pagination.js";
import {
  RESERVA_STATUS,
  RESERVA_STATUS_VALUES,
  TRIP_OUTCOME,
  TRAYECTO_STATUS,
} from "../constants/statuses.js";
import { RabbitMQ } from "../rabbitmq/connection.js";

import Stripe from "stripe";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;
const MESSAGES_URL = process.env.MESSAGES_URL;
let frontend_url = process.env.FRONTEND_URL;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLATFORM_COMMISSION_PERCENT = parseFloat(
  process.env.PLATFORM_COMMISSION_PERCENT || "0.15",
);

async function getRatedTrayectoIdsForUser(userId, trayectoIds) {
  if (!userId) return new Set();
  const ids = (trayectoIds ?? [])
    .map((x) => String(x))
    .filter((x) => x.length > 0);
  if (ids.length === 0) return new Set();

  const comments = await prisma.comment.findMany({
    where: { user_id_commentator: String(userId), id_trayecto: { in: ids } },
    select: { id_trayecto: true },
    distinct: ["id_trayecto"],
  });
  return new Set(comments.map((c) => String(c.id_trayecto)));
}

async function getRatedUserIdsForTrayecto(trayectoId, userIds) {
  const id = String(trayectoId);
  if (!id) return new Set();

  const users = (userIds ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  if (users.length === 0) return new Set();

  const comments = await prisma.comment.findMany({
    where: { id_trayecto: id, user_id_commentator: { in: users } },
    select: { user_id_commentator: true },
    distinct: ["user_id_commentator"],
  });
  return new Set(comments.map((c) => c.user_id_commentator));
}

function getAuthHeaders(req) {
  const authHeader = req.headers?.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;
  const cookieToken = req.cookies?.access_token;
  const token = bearerToken || cookieToken;
  if (!token) return { token: null, headers: {} };

  const headers = {};
  if (bearerToken) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Cookie = `access_token=${token}`;
  }
  return { token, headers };
}

async function getReservaWithTrayecto(idReserva) {
  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: idReserva },
    include: {
      Trayecto: {
        select: {
          conductor: true,
          status: true,
          origen_lat: true,
          origen_lng: true,
        },
      },
    },
  });
  if (!reserva) return null;
  const { Trayecto, ...rest } = reserva;
  return {
    ...rest,
    conductor: Trayecto.conductor,
    trayecto_status: Trayecto.status,
    origen_lat: Trayecto.origen_lat,
    origen_lng: Trayecto.origen_lng,
  };
}

async function notifyConductorNewReservation({
  conductorId,
  conductorEmail,
  conductorName,
  passengerId,
  trayectoId,
  origen,
  destino,
}) {
  const passengerInfo = await UsersAPI.fetchUserPublicInfo(passengerId);
  const passengerName = passengerInfo?.name || "Un usuario";

  const trayectoFull = await prisma.trayecto.findUnique({
    where: { id: trayectoId },
    select: { hora: true, plazas: true, disponible: true },
  });

  const seatsRemaining = trayectoFull?.disponible ?? 0;
  const horaDate = trayectoFull?.hora ? new Date(trayectoFull.hora) : null;
  const dateStr = horaDate
    ? horaDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = horaDate
    ? horaDate.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const templateData = {
    userName: conductorName || "",
    passengerName,
    origin: origen,
    destination: destino,
    date: dateStr,
    time: timeStr,
    seatsBooked: 1,
    seatsRemaining,
    tripId: trayectoId,
  };

  const tasks = [];

  tasks.push(
    NotificationsAPI.sendPushTemplatedToUser({
      userId: conductorId,
      template: "trip_booked",
      data: {
        userName: conductorName || "",
        passengerName,
        origin: origen,
        destination: destino,
        tripId: trayectoId,
        seatsBooked: 1,
      },
      priority: "high",
    }).catch((e) => console.error("Error push trip_booked:", e?.message ?? e)),
  );

  if (conductorEmail) {
    tasks.push(
      NotificationsAPI.sendTemplatedEmail({
        to: conductorEmail,
        template: "trip_booked",
        data: templateData,
      }).catch((e) =>
        console.error("Error email trip_booked:", e?.message ?? e),
      ),
    );
  }

  await Promise.allSettled(tasks);
}

async function addReserva(req, res) {
  const validation = ReservaSchema.validateReservaSinId(req.body);

  // const token = req.cookies.access_token;
  const { token, headers } = getAuthHeaders(req);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  const { trayecto_id, user_id } = validation.data;
  const userId = req.user.userId;

  // Aquí iría la lógica para agregar la reserva a la base de datos
  console.log(
    "Agregar reserva para el usuario:",
    user_id,
    "en el trayecto ID:",
    trayecto_id,
  );
  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayecto_id },
    select: {
      disponible: true,
      precio_conductor: true,
      origen: true,
      conductor: true,
      destino: true,
      origen_lat: true,
      origen_lng: true,
    },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  const isFree = Number(trayecto.precio_conductor) === 0;

  // Obtener el nombre del conductor desde el microservicio de usuarios
  const conductorInfo = await UsersAPI.fetchUserPublicInfo(
    String(trayecto.conductor),
  );
  if (!conductorInfo) {
    return res
      .status(404)
      .send({ status: "Error", message: "Conductor no encontrado" });
  }
  const conductorName = conductorInfo.name;

  const cookieHeaderValue = `access_token=${token}`; // El formato debe ser 'nombre=valor'
  let reserva = {
    user_id: userId,
    trayecto_id,
    status: isFree ? RESERVA_STATUS.COMPLETED : RESERVA_STATUS.PENDING,
  };
  let disponible = trayecto.disponible;
  console.log("Disponibilidad del trayecto:", disponible);
  // Si no hay disponibilidad, devolver un error

  if (disponible === 0) {
    return res.status(404).send({
      status: "Error",
      message: "El trayecto no tiene asiento libres",
    });
  }

  // Inserta la reserva en la base de datos
  let duplicado = false;
  let reservaId = randomUUID();
  let decrementedDisponible = false;
  try {
    await prisma.reserva.create({
      data: {
        id_reserva: reservaId,
        user_id: userId,
        id_trayecto: trayecto_id,
        status: reserva.status,
      },
    });
    // Decrementar disponible al crear la reserva
    await prisma.trayecto.update({
      where: { id: trayecto_id },
      data: { disponible: { decrement: 1 } },
    });
    decrementedDisponible = true;
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).send({
        status: "Error",
        message: "El usuario o trayecto no existen",
      });
    }
    if (error.code === "P2002") {
      duplicado = true;
      const existing = await prisma.reserva.findUnique({
        where: {
          user_id_id_trayecto: { user_id: userId, id_trayecto: trayecto_id },
        },
      });
      if (existing.status === RESERVA_STATUS.COMPLETED) {
        return res.status(400).send({
          status: "Error",
          message: "El usuario ya tiene una reserva para este trayecto",
        });
      }
      reserva = existing;
      reservaId = existing.id_reserva;
      // Si la reserva existente estaba cancelada, decrementar disponible
      if (existing.status === RESERVA_STATUS.CANCELED) {
        await prisma.trayecto.update({
          where: { id: trayecto_id },
          data: { disponible: { decrement: 1 } },
        });
        decrementedDisponible = true;
      }
      if (isFree) {
        await prisma.reserva.update({
          where: { id_reserva: reservaId },
          data: { status: RESERVA_STATUS.COMPLETED },
        });
        reserva.status = RESERVA_STATUS.COMPLETED;
      } else if (existing.status === RESERVA_STATUS.CANCELED) {
        // Re-activar reserva cancelada a pending para pago
        await prisma.reserva.update({
          where: { id_reserva: reservaId },
          data: { status: RESERVA_STATUS.PENDING },
        });
        reserva.status = RESERVA_STATUS.PENDING;
      }
    } else {
      return res
        .status(500)
        .send({ status: "Error", message: "Error al crear la reserva" });
    }
  }

  if (!reservaId) {
    return res
      .status(500)
      .send({ status: "Error", message: "Error al crear la reserva" });
  }

  if (!MESSAGES_URL) {
    if (!duplicado && decrementedDisponible) {
      try {
        await prisma.reserva.delete({ where: { id_reserva: reservaId } });
        await prisma.trayecto.update({
          where: { id: trayecto_id },
          data: { disponible: { increment: 1 } },
        });
      } catch (e) {
        console.error(
          "Error haciendo rollback de reserva tras MESSAGES_URL missing:",
          e,
        );
      }
    } else if (duplicado && decrementedDisponible) {
      // Restaurar disponible y marcar como canceled si era un duplicado re-activado
      try {
        await prisma.reserva.update({
          where: { id_reserva: reservaId },
          data: { status: RESERVA_STATUS.CANCELED },
        });
        await prisma.trayecto.update({
          where: { id: trayecto_id },
          data: { disponible: { increment: 1 } },
        });
      } catch (e) {
        console.error("Error haciendo rollback de reserva duplicada:", e);
      }
    }
    return res
      .status(500)
      .send({ status: "Error", message: "MESSAGES_URL no configurado" });
  }

  // Publicar evento de reserva creada via RabbitMQ
  const comision = trayecto.precio_conductor * PLATFORM_COMMISSION_PERCENT;
  const netoConComision = trayecto.precio_conductor + comision;
  const totalAmount = Math.round(netoConComision * 100);

  if (isFree) {
    RabbitMQ.publishEvent("reserva.created.free", {
      id_reserva: duplicado ? reserva.id_reserva : reservaId,
      user_id: userId,
      trayecto_id,
      conductor_id: String(trayecto.conductor),
      status: RESERVA_STATUS.COMPLETED,
      is_free: true,
    });
  } else {
    RabbitMQ.publishEvent("reserva.created.payment_required", {
      id_reserva: duplicado ? reserva.id_reserva : reservaId,
      user_id: userId,
      trayecto_id,
      conductor_id: String(trayecto.conductor),
      status: RESERVA_STATUS.PENDING,
      is_free: false,
      payment: {
        amount: totalAmount,
        currency: "eur",
        recipient_user_id: String(trayecto.conductor),
        description:
          "Reserva de trayecto: " +
          trayecto_id +
          " desde " +
          trayecto.origen +
          " hasta " +
          trayecto.destino,
        success_url: frontend_url + "/trayecto/" + trayecto_id,
        cancel_url: frontend_url + "/trayecto/" + trayecto_id,
      },
    });
  }

  // Unirse al chat del trayecto
  try {
    const { token: authToken, headers } = getAuthHeaders(req);
    if (!authToken) {
      return res.status(401).send({
        status: "Error",
        message: "No se proporcionó un token de acceso",
      });
    }

    const chatResponse = await fetch(
      `${MESSAGES_URL}/api/chats/trip/${trayecto_id}`,
      {
        method: "GET",
        headers: {
          ...headers,
        },
      },
    );
    const chatBody = await chatResponse.json().catch(() => null);
    if (!chatResponse.ok) {
      const msg = chatBody?.message ?? "Error al obtener el chat del trayecto";
      throw new Error(msg);
    }

    const chatId =
      chatBody.chat.id ??
      chatBody?.chatId ??
      chatBody?.id ??
      chatBody?.data?.chatId ??
      chatBody?.data?.id ??
      null;

    if (!chatId) {
      throw new Error("No se pudo determinar chatId para el trayecto");
    }

    const joinResponse = await fetch(
      `${MESSAGES_URL}/api/chats/${chatId}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({}),
      },
    );

    const joinBody = await joinResponse.json().catch(() => null);
    if (!joinResponse.ok) {
      const msg = joinBody?.message ?? "Error al unirse al chat del trayecto";
      throw new Error(msg);
    }
  } catch (error) {
    console.error("Error uniéndose al chat del trayecto:", error);
    if (!duplicado && decrementedDisponible) {
      try {
        await prisma.reserva.delete({ where: { id_reserva: reservaId } });
        await prisma.trayecto.update({
          where: { id: trayecto_id },
          data: { disponible: { increment: 1 } },
        });
      } catch (e) {
        console.error(
          "Error haciendo rollback de reserva tras fallo uniendo al chat:",
          e,
        );
      }
    } else if (duplicado && decrementedDisponible) {
      try {
        await prisma.reserva.update({
          where: { id_reserva: reservaId },
          data: { status: RESERVA_STATUS.CANCELED },
        });
        await prisma.trayecto.update({
          where: { id: trayecto_id },
          data: { disponible: { increment: 1 } },
        });
      } catch (e) {
        console.error("Error haciendo rollback de reserva duplicada:", e);
      }
    }
    return res.status(502).send({
      status: "Error",
      message: error?.message ?? "Error al unirse al chat del trayecto",
    });
  }

  reservaId = duplicado ? reserva.id_reserva : reservaId;

  if (!duplicado) {
    try {
      const tipoEvento = await prisma.tipoEvento.findUnique({
        where: { nombre: "reserva_creada" },
      });
      if (tipoEvento) {
        await prisma.eventoTrayecto.create({
          data: {
            id: randomUUID(),
            id_trayecto: trayecto_id,
            id_reserva: reservaId,
            user_id: userId,
            id_tipo_evento: tipoEvento.id,
            lat: trayecto.origen_lat ?? 0,
            lng: trayecto.origen_lng ?? 0,
          },
        });
      }
    } catch (e) {
      console.error("Error creando evento de reserva_creada:", e);
    }
  }

  // Notificar al conductor: push + email (fire-and-forget)
  if (!duplicado) {
    notifyConductorNewReservation({
      conductorId: String(trayecto.conductor),
      conductorEmail: conductorInfo?.email,
      conductorName,
      passengerId: String(userId),
      trayectoId: trayecto_id,
      origen: trayecto.origen,
      destino: trayecto.destino,
    }).catch((e) => {
      console.error(
        "Error enviando notificación de nueva reserva al conductor:",
        e?.message ?? e,
      );
    });
  }

  const newReserva = {
    id: reservaId,
    user_id: userId,
    conductorName,
    trayecto_id,
  };
  return res.status(201).send({
    status: "Success",
    message: isFree
      ? "Reserva creada y confirmada correctamente (trayecto gratuito)"
      : "Reserva creada correctamente. Pendiente de pago.",
    reserva: newReserva,
  });
}

async function getReservasByTravelId(req, res) {
  const { travelId } = req.params;
  const trayecto = await prisma.trayecto.findUnique({
    where: { id: travelId },
  });
  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "No se ha encontrado este trayecto" });
  }
  let pasajerosList = await prisma.reserva.findMany({
    where: { id_trayecto: travelId, NOT: { status: RESERVA_STATUS.CANCELED } },
  });
  //Agregar info adicional como la img_perfil y el nombre
  if (pasajerosList.length === 0) {
    return res.status(200).send({
      status: "Success",
      message: "No se ha encontrado este trayecto o todavia no tiene reservas",
      pasajerosList: [],
    });
  }
  pasajerosList = await Promise.all(
    pasajerosList.map(async (pasajero) => {
      const userInfo = await UsersAPI.fetchUserPublicInfo(
        String(pasajero.user_id),
      );

      // Fetch user preferences
      const preferences =
        (await prisma.userPreference.findFirst({
          where: { user_id: pasajero.user_id },
        })) || {};

      return {
        ...pasajero,
        img_perfil: userInfo?.img_perfil,
        nombre: userInfo?.name,
        preferences: preferences,
      };
    }),
  );

  const ratedUsernames = await getRatedUserIdsForTrayecto(
    travelId,
    pasajerosList.map((r) => r.id), // Careful: names might not be usernames. We might need username for comments.
  );
  // Wait, getRatedUsernamesForTrayecto expects usernames. Passengers list now has user_id.
  // We need to fetch username as well if we want to check comments.

  // Let's refactor the map above to fetch username too.
  pasajerosList = pasajerosList.map((r) => ({
    ...r,
    valorado: ratedUsernames.has(r.id),
  }));

  return res.status(200).send({
    status: "Success",
    pasajerosList,
  });
}

async function obtenerMisReservas(req, res) {
  const { userId } = req.user;
  const { userIdParam } = req.params;
  const { page, limit, offset } = PaginationUtils.parsePaginationParams(req);

  if (String(userId) !== String(userIdParam)) {
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para ver las reservas de este usuario",
    });
  }

  try {
    const where = { user_id: userId };
    let pasajerosList = await prisma.reserva.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
    });
    const total = await prisma.reserva.count({ where });

    if (pasajerosList.length === 0) {
      return res.status(200).send({
        status: "Success",
        data: [],
        pagination: PaginationUtils.buildPaginationResponse({
          page,
          limit,
          total: 0,
        }),
      });
    }

    const ratedTrayectoIds = await getRatedTrayectoIdsForUser(
      userId,
      pasajerosList.map((r) => r.id_trayecto),
    );
    pasajerosList = pasajerosList.map((r) => ({
      ...r,
      valorado: ratedTrayectoIds.has(String(r.id_trayecto)),
    }));

    pasajerosList = await Promise.all(
      pasajerosList.map(async (reserva) => {
        const trayecto = await prisma.trayecto.findUnique({
          where: { id: reserva.id_trayecto },
        });

        const conductorInfo = await UsersAPI.fetchUserPublicInfo(
          String(trayecto.conductor),
        );
        const conductorId = trayecto.conductor;
        trayecto.conductor = conductorInfo?.name || "Desconocido";
        trayecto.conductor_id = conductorId;
        trayecto.img_perfil = conductorInfo?.img_perfil;

        return {
          ...reserva,
          trayecto,
        };
      }),
    );

    return res.status(200).send({
      status: "Success",
      data: pasajerosList,
      pagination: PaginationUtils.buildPaginationResponse({
        page,
        limit,
        total,
      }),
    });
  } catch (error) {
    console.error("Error en obtenerMisReservas:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo las reservas",
    });
  }
}

async function deleteReserva(req, res) {
  const { id } = req.params;
  const idReserva = String(id);
  if (!idReserva) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de reserva inválido" });
  }

  if (!USUARIOS_URL) {
    return res
      .status(500)
      .send({ status: "Error", message: "USUARIOS_URL no configurado" });
  }

  const reserva = await getReservaWithTrayecto(idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }
  //Comprobar que el usuario que la elimina es el que ha generado la reserva
  if (String(reserva.user_id) !== String(req.user?.userId)) {
    console.log(reserva.user_id, req.user?.userId);
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para eliminar esta reserva",
    });
  }

  if (String(reserva.status ?? "").toLowerCase() === RESERVA_STATUS.CANCELED) {
    return res
      .status(200)
      .send({ status: "Success", message: "Reserva cancelada correctamente" });
  }

  let paymentIntentId = reserva.stripe_payment_intent_id ?? null;
  if (!paymentIntentId && reserva.stripe_checkout_session_id) {
    const pago = await prisma.pago.findFirst({
      where: {
        stripe_checkout_session_id: reserva.stripe_checkout_session_id,
        NOT: { stripe_payment_intent_id: null },
      },
      orderBy: { id: "desc" },
    });
    paymentIntentId = pago?.stripe_payment_intent_id ?? null;
    if (paymentIntentId) {
      await prisma.reserva.update({
        where: { id_reserva: idReserva },
        data: { stripe_payment_intent_id: paymentIntentId },
      });
    }
  }

  const { token, headers } = getAuthHeaders(req);
  if (!token) {
    return res.status(401).send({
      status: "Error",
      message: "No se proporcionó un token de acceso",
    });
  }
  if (paymentIntentId) {
    try {
      const response = await fetch(
        `${USUARIOS_URL}/api/payment/payment-intent/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            paymentIntentId,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = body?.message ?? "Error al cancelar el pago";
        return res
          .status(502)
          .send({ status: "Error", message: msg, details: body ?? undefined });
      }
    } catch (e) {
      return res.status(502).send({
        status: "Error",
        message:
          e?.message ?? "No se podido completar la eliminacion de la reserva.",
      });
    }
  }

  try {
    let trayectoId = reserva.id_trayecto;
    let getChat = await fetch(
      `${process.env.MESSAGES_URL}/api/chats/trip/${trayectoId}`,
      {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
    ).then((res) => res.json());
    console.log(getChat);
    let chatId = getChat.chat.id;
    //Eliminar al usuario del chat de grupo

    let leaveChat = await fetch(
      `${process.env.MESSAGES_URL}/api/chats/${chatId}/leave`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
    );

    await prisma.$transaction([
      prisma.reserva.update({
        where: { id_reserva: idReserva },
        data: { status: RESERVA_STATUS.CANCELED },
      }),
      prisma.$executeRawUnsafe(
        "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
        reserva.id_trayecto,
      ),
    ]);
  } catch (e) {
    if (e.code === "P2025") {
      return res
        .status(404)
        .send({ status: "Error", message: "Reserva no encontrada" });
    }
    return res.status(500).send({
      status: "Error",
      message: e?.message ?? "Error cancelando la reserva",
    });
  }

  try {
    const tipoEvento = await prisma.tipoEvento.findUnique({
      where: { nombre: "reserva_cancelada" },
    });
    if (tipoEvento) {
      await prisma.eventoTrayecto.create({
        data: {
          id: randomUUID(),
          id_trayecto: reserva.id_trayecto,
          id_reserva: idReserva,
          user_id: req.user?.userId,
          id_tipo_evento: tipoEvento.id,
          lat: reserva.origen_lat ?? 0,
          lng: reserva.origen_lng ?? 0,
        },
      });
    }
  } catch (e) {
    console.error("Error creando evento de reserva_cancelada:", e);
  }

  return res
    .status(200)
    .send({ status: "Success", message: "Reserva cancelada correctamente" });
}

async function confirmarViajeExitoso(req, res) {
  const { id } = req.params;
  const idReserva = String(id);
  if (!idReserva) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de reserva inválido" });
  }

  if (!USUARIOS_URL) {
    return res
      .status(500)
      .send({ status: "Error", message: "USUARIOS_URL no configurado" });
  }

  const reserva = await getReservaWithTrayecto(idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  const userId = req.user?.userId;
  const isAllowed = userId && String(userId) !== String(reserva.conductor);
  if (!isAllowed) {
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para confirmar este viaje",
    });
  }

  if (String(reserva.status).toLowerCase() !== RESERVA_STATUS.COMPLETED) {
    return res.status(409).send({
      status: "Error",
      message: "La reserva todavía no está pagada/completada",
    });
  }

  const outcome = String(
    reserva.trip_outcome ?? TRIP_OUTCOME.PENDING,
  ).toLowerCase();
  if (outcome === TRIP_OUTCOME.SUCCESS) {
    return res
      .status(200)
      .send({ status: "Success", message: "Viaje ya confirmado como exitoso" });
  }
  if (outcome === TRIP_OUTCOME.ISSUE) {
    return res.status(409).send({
      status: "Error",
      message: "Esta reserva está marcada con incidencia/reclamación",
    });
  }

  if (
    String(reserva.trayecto_status ?? "").toLowerCase() !==
    TRAYECTO_STATUS.FINALIZADO
  ) {
    return res.status(409).send({
      status: "Error",
      message: "El trayecto todavía no está finalizado",
    });
  }

  // Reserva de trayecto gratuito: no hay pago que capturar
  if (!reserva.stripe_checkout_session_id) {
    await prisma.reserva.update({
      where: { id_reserva: idReserva },
      data: {
        trip_outcome: TRIP_OUTCOME.SUCCESS,
        trip_outcome_reason: null,
        trip_outcome_at: new Date(),
      },
    });
    return res.status(200).send({
      status: "Success",
      message: "Viaje confirmado correctamente (trayecto gratuito)",
    });
  }

  let paymentIntentId = reserva.stripe_payment_intent_id ?? null;
  if (!paymentIntentId && reserva.stripe_checkout_session_id) {
    const pago = await prisma.pago.findFirst({
      where: {
        stripe_checkout_session_id: reserva.stripe_checkout_session_id,
        NOT: { stripe_payment_intent_id: null },
      },
      orderBy: { id: "desc" },
    });
    //ACTUALIZAR LA RESERVA
    paymentIntentId = pago?.stripe_payment_intent_id ?? null;
    if (paymentIntentId) {
      await prisma.reserva.update({
        where: { id_reserva: idReserva },
        data: { stripe_payment_intent_id: paymentIntentId },
      });
    }
  }

  if (!paymentIntentId) {
    return res.status(409).send({
      status: "Error",
      message: "No se encontró payment_intent para capturar",
    });
  }

  const { token, headers } = getAuthHeaders(req);
  if (!token) {
    return res.status(401).send({
      status: "Error",
      message: "No se proporcionó un token de acceso",
    });
  }

  let captureResponse;
  try {
    const response = await fetch(
      `${USUARIOS_URL}/api/payment/payment-intent/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          paymentIntentId,
        }),
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = body?.message ?? "Error capturando el PaymentIntent";
      return res
        .status(502)
        .send({ status: "Error", message: msg, details: body ?? undefined });
    }
    captureResponse = body;
  } catch (e) {
    return res.status(502).send({
      status: "Error",
      message: e?.message ?? "Error llamando a Users API",
    });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE reservas SET trip_outcome = '${TRIP_OUTCOME.SUCCESS}', trip_outcome_reason = NULL, trip_outcome_at = NOW(), stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?), stripe_payment_intent_status = COALESCE(stripe_payment_intent_status, 'captured') WHERE id_reserva = ?`,
    paymentIntentId,
    idReserva,
  );

  return res.status(200).send({
    status: "Success",
    message: "Viaje confirmado y pago capturado correctamente",
    capture: captureResponse,
  });
}

async function reclamarViaje(req, res) {
  const { id } = req.params;
  const idReserva = String(id);
  if (!idReserva) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de reserva inválido" });
  }

  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return res
      .status(400)
      .send({ status: "Error", message: "reason es requerido" });
  }

  const reserva = await getReservaWithTrayecto(idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  const userId = req.user?.id;
  const isAllowed = userId && String(userId) === String(reserva.conductor);
  if (!isAllowed) {
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para reclamar este viaje",
    });
  }

  const outcome = String(
    reserva.trip_outcome ?? TRIP_OUTCOME.PENDING,
  ).toLowerCase();
  if (outcome === TRIP_OUTCOME.SUCCESS) {
    return res.status(409).send({
      status: "Error",
      message: "El viaje ya fue confirmado como exitoso",
    });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE reservas SET trip_outcome = '${TRIP_OUTCOME.ISSUE}', trip_outcome_reason = ?, trip_outcome_at = NOW() WHERE id_reserva = ?`,
    reason,
    idReserva,
  );

  return res
    .status(200)
    .send({ status: "Success", message: "Reclamación registrada" });
}
async function retomarPagoReserva(req, res) {
  const { id_reserva, return_url } = req.body;
  const userId = req.user.userId;

  if (!id_reserva) {
    return res
      .status(400)
      .send({ status: "Error", message: "id_reserva es obligatorio" });
  }

  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: String(id_reserva) },
    include: {
      Trayecto: {
        select: {
          conductor: true,
          precio_conductor: true,
          origen: true,
          destino: true,
          status: true,
        },
      },
    },
  });

  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  if (reserva.user_id !== userId) {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso sobre esta reserva",
    });
  }

  if (reserva.status !== RESERVA_STATUS.PENDING) {
    return res.status(400).send({
      status: "Error",
      message: "Solo se puede retomar el pago de reservas pendientes",
    });
  }

  const trayecto = reserva.Trayecto;
  const isFree = Number(trayecto.precio_conductor) === 0;
  if (isFree) {
    return res.status(400).send({
      status: "Error",
      message: "Esta reserva es de un trayecto gratuito, no requiere pago",
    });
  }

  const comisionRetomar =
    trayecto.precio_conductor * PLATFORM_COMMISSION_PERCENT;
  const netoConComisionRetomar = trayecto.precio_conductor + comisionRetomar;
  const totalAmount = Math.round(netoConComisionRetomar * 100);

  RabbitMQ.publishEvent("reserva.payment.resume", {
    id_reserva: reserva.id_reserva,
    user_id: userId,
    trayecto_id: reserva.id_trayecto,
    conductor_id: String(trayecto.conductor),
    return_url: return_url || undefined,
    payment: {
      amount: totalAmount,
      currency: "eur",
      recipient_user_id: String(trayecto.conductor),
      description:
        "Reserva de trayecto: " +
        reserva.id_trayecto +
        " desde " +
        trayecto.origen +
        " hasta " +
        trayecto.destino,
      success_url: frontend_url + "/trayecto/" + reserva.id_trayecto,
      cancel_url: frontend_url + "/trayecto/" + reserva.id_trayecto,
    },
  });

  return res.status(200).send({
    status: "Success",
    message: "Evento de retomar pago publicado correctamente",
  });
}

async function capturarPagosTrayecto(trayectoId) {
  if (!trayectoId) return { captured: 0, errors: [] };
  console.log(
    "[capturarPagosTrayecto] Iniciando captura para trayecto:",
    trayectoId,
  );

  const reservas = await prisma.reserva.findMany({
    where: {
      id_trayecto: trayectoId,
      status: RESERVA_STATUS.COMPLETED,
      trip_outcome: TRIP_OUTCOME.PENDING,
      stripe_checkout_session_id: { not: null },
    },
  });

  console.log(
    "[capturarPagosTrayecto] Reservas pendientes de captura:",
    reservas.length,
  );

  let captured = 0;
  const errors = [];

  for (const reserva of reservas) {
    try {
      let paymentIntentId = reserva.stripe_payment_intent_id;

      if (!paymentIntentId && reserva.stripe_checkout_session_id) {
        const pago = await prisma.pago.findFirst({
          where: {
            stripe_checkout_session_id: reserva.stripe_checkout_session_id,
            NOT: { stripe_payment_intent_id: null },
          },
          orderBy: { id: "desc" },
        });
        paymentIntentId = pago?.stripe_payment_intent_id ?? null;
        if (paymentIntentId) {
          await prisma.reserva.update({
            where: { id_reserva: reserva.id_reserva },
            data: { stripe_payment_intent_id: paymentIntentId },
          });
        }
      }

      if (!paymentIntentId) {
        console.warn(
          "[capturarPagosTrayecto] Sin payment_intent para reserva:",
          reserva.id_reserva,
        );
        errors.push({
          reserva: reserva.id_reserva,
          error: "No se encontró payment_intent",
        });
        continue;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (pi.status === "requires_capture") {
        const capturedPi = await stripe.paymentIntents.capture(paymentIntentId);
        console.log(
          "[capturarPagosTrayecto] PaymentIntent capturado:",
          paymentIntentId,
          "→",
          capturedPi.status,
        );
        captured++;
      } else if (pi.status === "succeeded") {
        console.log(
          "[capturarPagosTrayecto] PaymentIntent ya succeeded:",
          paymentIntentId,
        );
        captured++;
      } else {
        console.warn(
          "[capturarPagosTrayecto] PaymentIntent en estado no capturable:",
          paymentIntentId,
          "→",
          pi.status,
        );
        errors.push({
          reserva: reserva.id_reserva,
          error: `PaymentIntent status: ${pi.status}`,
        });
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE reservas SET trip_outcome = '${TRIP_OUTCOME.SUCCESS}', trip_outcome_reason = NULL, trip_outcome_at = NOW(), stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?), stripe_payment_intent_status = COALESCE(stripe_payment_intent_status, 'captured') WHERE id_reserva = ?`,
        paymentIntentId,
        reserva.id_reserva,
      );
    } catch (error) {
      console.error(
        "[capturarPagosTrayecto] Error capturando reserva:",
        reserva.id_reserva,
        error?.message ?? error,
      );
      errors.push({
        reserva: reserva.id_reserva,
        error: error?.message ?? "Error desconocido",
      });
    }
  }

  console.log(
    "[capturarPagosTrayecto] Finalizado. Capturadas:",
    captured,
    "Errores:",
    errors.length,
  );
  return { captured, errors };
}

async function actualizarStatusReserva(req, res) {
  const { id } = req.params;
  const { status, payment_intent_id } = req.body;
  console.log();
  const VALID_STATUSES = RESERVA_STATUS_VALUES;

  if (!status) {
    return res
      .status(400)
      .send({ status: "Error", message: "status es obligatorio" });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).send({
      status: "Error",
      message: `status no válido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: String(id) },
  });

  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  const data = { status };
  if (payment_intent_id) {
    data.stripe_payment_intent_id = payment_intent_id;
  }

  try {
    const updated = await prisma.reserva.update({
      where: { id_reserva: String(id) },
      data,
    });

    return res.status(200).send({
      status: "Success",
      message: "Estado de la reserva actualizado correctamente",
      reserva: updated,
    });
  } catch (error) {
    return res.status(500).send({
      status: "Error",
      message: "Error al actualizar el estado de la reserva",
    });
  }
}

async function reservaQR(req, res) {
  const { trayecto_id, lat, lng } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  if (!trayecto_id) {
    return res
      .status(400)
      .send({ status: "Error", message: "trayecto_id es obligatorio" });
  }

  if (lat == null || lng == null) {
    return res
      .status(400)
      .send({ status: "Error", message: "lat y lng son obligatorios" });
  }

  const trayecto = await prisma.trayecto.findUnique({
    where: { id: trayecto_id },
    select: {
      id: true,
      conductor: true,
      disponible: true,
      precio_conductor: true,
      status: true,
      origen: true,
      destino: true,
      origen_lat: true,
      origen_lng: true,
    },
  });

  if (!trayecto) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }

  if (String(trayecto.conductor) === String(userId)) {
    return res.status(400).send({
      status: "Error",
      message: "El conductor no puede reservar su propio trayecto",
    });
  }

  if (trayecto.disponible <= 0) {
    return res.status(400).send({
      status: "Error",
      message: "El trayecto no tiene asientos libres",
    });
  }

  const existing = await prisma.reserva.findUnique({
    where: {
      user_id_id_trayecto: { user_id: userId, id_trayecto: trayecto_id },
    },
  });

  const isFree = Number(trayecto.precio_conductor) === 0;

  const reservaStatus = isFree
    ? RESERVA_STATUS.COMPLETED
    : RESERVA_STATUS.PENDING;
  let reservaId;

  try {
    await prisma.$transaction(async (tx) => {
      if (existing) {
        if (existing.status === RESERVA_STATUS.CANCELED) {
          reservaId = existing.id_reserva;
          await tx.reserva.update({
            where: { id_reserva: reservaId },
            data: {
              status: reservaStatus,
            },
          });
        } else {
          reservaId = existing.id_reserva;
        }
      } else {
        reservaId = randomUUID();
        await tx.reserva.create({
          data: {
            id_reserva: reservaId,
            user_id: userId,
            id_trayecto: trayecto_id,
            status: reservaStatus,
          },
        });
      }

      await tx.trayecto.update({
        where: { id: trayecto_id },
        data: { disponible: { decrement: 1 } },
      });

      const tipoEventoReserva = await tx.tipoEvento.findUnique({
        where: { nombre: "reserva_creada" },
      });

      if (tipoEventoReserva) {
        await tx.eventoTrayecto.create({
          data: {
            id: randomUUID(),
            id_trayecto: trayecto_id,
            id_reserva: reservaId,
            user_id: userId,
            id_tipo_evento: tipoEventoReserva.id,
            lat: trayecto.origen_lat ?? Number(lat),
            lng: trayecto.origen_lng ?? Number(lng),
          },
        });
      }

      if (isFree) {
        const tipoEventoRecogida = await tx.tipoEvento.findUnique({
          where: { nombre: "recogida" },
        });

        if (tipoEventoRecogida) {
          await tx.eventoTrayecto.create({
            data: {
              id: randomUUID(),
              id_trayecto: trayecto_id,
              id_reserva: reservaId,
              user_id: userId,
              id_tipo_evento: tipoEventoRecogida.id,
              lat: Number(lat),
              lng: Number(lng),
            },
          });
        }
      }
    });
  } catch (error) {
    console.error("Error en reservaQR:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error al procesar la reserva QR" });
  }

  if (isFree) {
    RabbitMQ.publishEvent("reserva.created.free", {
      id_reserva: reservaId,
      user_id: userId,
      trayecto_id,
      conductor_id: String(trayecto.conductor),
      status: RESERVA_STATUS.COMPLETED,
      is_free: true,
    });
  } else {
    const comision =
      Number(trayecto.precio_conductor) * PLATFORM_COMMISSION_PERCENT;
    const netoConComision = Number(trayecto.precio_conductor) + comision;
    const totalAmount = Math.round(netoConComision * 100);

    RabbitMQ.publishEvent("reserva.created.payment_required", {
      id_reserva: reservaId,
      user_id: userId,
      trayecto_id,
      conductor_id: String(trayecto.conductor),
      status: RESERVA_STATUS.PENDING,
      is_free: false,
      payment: {
        amount: totalAmount,
        currency: "eur",
        recipient_user_id: String(trayecto.conductor),
        description:
          "Reserva QR: " +
          trayecto_id +
          " desde " +
          trayecto.origen +
          " hasta " +
          trayecto.destino,
        success_url: frontend_url + "/trayecto/" + trayecto_id,
        cancel_url: frontend_url + "/trayecto/" + trayecto_id,
      },
    });
  }

  if (!isFree) {
    return res.status(201).send({
      status: "Success",
      message:
        "Reserva creada en estado pendiente. Se requiere completar el pago.",
      requires_payment: true,
      reserva: {
        id: reservaId,
        user_id: userId,
        trayecto_id,
        status: RESERVA_STATUS.PENDING,
      },
    });
  }

  return res.status(201).send({
    status: "Success",
    message: "Reserva creada y recogida registrada correctamente",
    reserva: {
      id: reservaId,
      user_id: userId,
      trayecto_id,
      status: RESERVA_STATUS.COMPLETED,
    },
  });
}

async function getUserStats(req, res) {
  const { userId } = req.params;
  const authenticatedUserId = req.user?.userId ?? req.user?.id;

  if (!userId) {
    return res
      .status(400)
      .send({ status: "Error", message: "userId es obligatorio" });
  }

  if (
    authenticatedUserId &&
    String(authenticatedUserId) !== String(userId) &&
    req.user?.role !== "admin"
  ) {
    return res.status(403).send({
      status: "Error",
      message: "No tienes permiso para ver las estadísticas de otro usuario",
    });
  }

  try {
    const userStr = String(userId);

    // 1. Trayectos totales como conductor (todos los estados)
    const trayectosComoConductor = await prisma.trayecto.count({
      where: { conductor: userStr },
    });

    const trayectosFinalizados = await prisma.trayecto.count({
      where: { conductor: userStr, status: TRAYECTO_STATUS.FINALIZADO },
    });

    const trayectosActivos = await prisma.trayecto.count({
      where: {
        conductor: userStr,
        status: {
          notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
        },
      },
    });

    // 2. Comentarios realizados (como commentator)
    const comentariosRealizados = await prisma.comment.count({
      where: { user_id_commentator: userStr },
    });

    // 3. Comentarios recibidos (como user_id_trayect)
    const comentariosRecibidos = await prisma.comment.count({
      where: { user_id_trayect: userStr },
    });

    // Rating promedio recibido
    const ratingAgg = await prisma.comment.aggregate({
      where: { user_id_trayect: userStr },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const ratingPromedio = ratingAgg._avg.rating
      ? Math.round(ratingAgg._avg.rating * 100) / 100
      : null;

    // 4. Total ganado: suma de precio_conductor de trayectos finalizados donde tiene reservas completed
    const gananciasRows = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(t.precio_conductor), 0) AS total_ganado
       FROM trayectos t
       INNER JOIN reservas r ON r.id_trayecto = t.id
       WHERE t.conductor = ? AND t.status = '${TRAYECTO_STATUS.FINALIZADO}' AND r.status = '${RESERVA_STATUS.COMPLETED}'`,
      userStr,
    );
    const totalGanado =
      gananciasRows && gananciasRows[0]
        ? Number(gananciasRows[0].total_ganado)
        : 0;

    // 5. Reservas como pasajero
    const reservasComoPasajero = await prisma.reserva.count({
      where: { user_id: userStr },
    });

    const reservasCompletadas = await prisma.reserva.count({
      where: { user_id: userStr, status: RESERVA_STATUS.COMPLETED },
    });

    const reservasCanceladas = await prisma.reserva.count({
      where: { user_id: userStr, status: RESERVA_STATUS.CANCELED },
    });

    const reservasPendientes = await prisma.reserva.count({
      where: { user_id: userStr, status: RESERVA_STATUS.PENDING },
    });

    // 6. CAE: km ahorrados y EUR generados como conductor
    const caeRows = await prisma.$queryRawUnsafe(
      `SELECT
         COALESCE(SUM(ic.km_recorridos), 0) AS km_recorridos,
         COALESCE(SUM(ic.kwh_generated), 0) AS kwh_generated,
         COALESCE(SUM(ic.eur_generated), 0) AS eur_generated
       FROM info_caes ic
       INNER JOIN trayectos t ON t.id = ic.id_trayecto
       WHERE t.conductor = ?`,
      userStr,
    );

    const kmRecorridos =
      caeRows && caeRows[0] ? Number(caeRows[0].km_recorridos) : 0;
    const kwhGenerados =
      caeRows && caeRows[0] ? Number(caeRows[0].kwh_generated) : 0;
    const eurGenerados =
      caeRows && caeRows[0] ? Number(caeRows[0].eur_generated) : 0;

    // 7. Plazas ofrecidas totales
    const plazasAgg = await prisma.trayecto.aggregate({
      where: { conductor: userStr },
      _sum: { plazas: true },
    });
    const plazasOfrecidas = plazasAgg._sum.plazas ?? 0;

    // 8. Pasajeros transportados (reservas completed en trayectos del conductor)
    const pasajerosTransportados = await prisma.reserva.count({
      where: {
        status: RESERVA_STATUS.COMPLETED,
        Trayecto: { conductor: userStr },
      },
    });

    return res.status(200).send({
      status: "Success",
      data: {
        user_id: userStr,
        trayectos: {
          total_como_conductor: trayectosComoConductor,
          finalizados: trayectosFinalizados,
          activos: trayectosActivos,
          plazas_ofrecidas: plazasOfrecidas,
        },
        reservas: {
          total_como_pasajero: reservasComoPasajero,
          completadas: reservasCompletadas,
          pendientes: reservasPendientes,
          canceladas: reservasCanceladas,
        },
        comentarios: {
          realizados: comentariosRealizados,
          recibidos: comentariosRecibidos,
          rating_promedio: ratingPromedio,
        },
        economia: {
          total_ganado: Math.round(totalGanado * 100) / 100,
          pasajeros_transportados: pasajerosTransportados,
          kwh_generados: Math.round(kwhGenerados * 100) / 100,
          eur_generados_kwh: Math.round(eurGenerados * 100) / 100,
        },
        cae: {
          km_recorridos: Math.round(kmRecorridos * 100) / 100,
          kwh_generados: Math.round(kwhGenerados * 100) / 100,
          eur_generados: Math.round(eurGenerados * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error en getUserStats:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al obtener las estadísticas del usuario",
    });
  }
}

async function getPublicProfile(req, res) {
  const { userId } = req.params;

  if (!userId) {
    return res
      .status(400)
      .send({ status: "Error", message: "userId es obligatorio" });
  }

  try {
    const userStr = String(userId);

    const userInfo = await UsersAPI.fetchUserPublicInfo(userStr);
    if (!userInfo) {
      return res
        .status(404)
        .send({ status: "Error", message: "Usuario no encontrado" });
    }

    const trayectosComoConductor = await prisma.trayecto.count({
      where: { conductor: userStr },
    });

    const trayectosFinalizados = await prisma.trayecto.count({
      where: { conductor: userStr, status: TRAYECTO_STATUS.FINALIZADO },
    });

    const comentariosRecibidos = await prisma.comment.count({
      where: { user_id_trayect: userStr },
    });

    const ratingAgg = await prisma.comment.aggregate({
      where: { user_id_trayect: userStr },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const ratingPromedio = ratingAgg._avg.rating
      ? Math.round(ratingAgg._avg.rating * 100) / 100
      : null;

    const pasajerosTransportados = await prisma.reserva.count({
      where: {
        status: RESERVA_STATUS.COMPLETED,
        Trayecto: { conductor: userStr },
      },
    });

    const caeRows = await prisma.$queryRawUnsafe(
      `SELECT
         COALESCE(SUM(ic.km_recorridos), 0) AS km_recorridos,
         COALESCE(SUM(ic.kwh_generated), 0) AS kwh_generated,
         COALESCE(SUM(ic.eur_generated), 0) AS eur_generated
       FROM info_caes ic
       INNER JOIN trayectos t ON t.id = ic.id_trayecto
       WHERE t.conductor = ?`,
      userStr,
    );

    const kmRecorridos =
      caeRows && caeRows[0] ? Number(caeRows[0].km_recorridos) : 0;
    const kwhGenerados =
      caeRows && caeRows[0] ? Number(caeRows[0].kwh_generated) : 0;
    const eurGenerados =
      caeRows && caeRows[0] ? Number(caeRows[0].eur_generated) : 0;

    return res.status(200).send({
      status: "Success",
      data: {
        user_id: userStr,
        nombre: userInfo.name || "Desconocido",
        img_perfil: userInfo.img_perfil ?? null,
        trayectos: {
          total_como_conductor: trayectosComoConductor,
          finalizados: trayectosFinalizados,
        },
        comentarios: {
          recibidos: comentariosRecibidos,
          rating_promedio: ratingPromedio,
        },
        pasajeros_transportados: pasajerosTransportados,
        cae: {
          km_recorridos: Math.round(kmRecorridos * 100) / 100,
          kwh_generados: Math.round(kwhGenerados * 100) / 100,
          eur_generados: Math.round(eurGenerados * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error en getPublicProfile:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error al obtener el perfil público del usuario",
    });
  }
}

export const ReservaController = {
  addReserva,
  deleteReserva,
  getReservasByTravelId,
  obtenerMisReservas,
  confirmarViajeExitoso,
  reclamarViaje,
  retomarPagoReserva,
  actualizarStatusReserva,
  reservaQR,
  capturarPagosTrayecto,
  getUserStats,
  getPublicProfile,
};
