import { randomUUID } from "crypto";
import { ReservaSchema } from "../schemas/reserva.js";
import { prisma } from "../database.js";
import dotenv from "dotenv";
import { UsersAPI } from "../utils/users-api.js";

import Stripe from "stripe";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;
const MESSAGES_URL = process.env.MESSAGES_URL;
let frontend_url = process.env.FRONTEND_URL;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
      precio: true,
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

  const isFree = Number(trayecto.precio) === 0;

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
    status: isFree ? "completed" : "pending",
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
  try {
    await prisma.reserva.create({
      data: {
        id_reserva: reservaId,
        user_id: userId,
        id_trayecto: trayecto_id,
        status: reserva.status,
      },
    });
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
      if (existing.status === "completed") {
        return res.status(400).send({
          status: "Error",
          message: "El usuario ya tiene una reserva para este trayecto",
        });
      }
      reserva = existing;
      reservaId = existing.id_reserva;
      if (isFree) {
        await prisma.reserva.update({
          where: { id_reserva: reservaId },
          data: { status: "completed" },
        });
        reserva.status = "completed";
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
    if (!duplicado) {
      try {
        await prisma.reserva.delete({ where: { id_reserva: reservaId } });
      } catch (e) {
        console.error(
          "Error haciendo rollback de reserva tras MESSAGES_URL missing:",
          e,
        );
      }
    }
    return res
      .status(500)
      .send({ status: "Error", message: "MESSAGES_URL no configurado" });
  }

  // Crear la sesión de pago en Stripe (solo si el trayecto no es gratuito)
  let checkout_session = null;
  if (!isFree) {
    let totalAmount = trayecto.precio * 100;
    try {
      checkout_session = await fetch(
        `${USUARIOS_URL}/api/payment/payment-intent/checkout`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeaderValue,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: totalAmount,
            recipient_user_id: String(trayecto.conductor),
            currency: "eur",
            description:
              "Reserva de trayecto: " +
              trayecto_id +
              " desde " +
              trayecto.origen +
              " hasta " +
              trayecto.destino,
            success_url: frontend_url + "/trayecto/" + trayecto_id,
            cancel_url: frontend_url + "/trayecto/" + trayecto_id,
            trayecto_id,
            id_reserva: duplicado ? reserva.id_reserva : reservaId,
          }),
        },
      ).then(async (response) => {
        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          const err = new Error(
            errBody?.message ?? "Error al crear el PaymentIntent en Stripe",
          );
          err.status = response.status;
          err.code = errBody?.code;
          throw err;
        }
        return await response.json();
      });
    } catch (error) {
      const status = error.status || 400;
      return res.status(status).send({
        status: "Error",
        code: error.code,
        message: error.message,
      });
    }
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
    if (!duplicado) {
      try {
        await prisma.reserva.delete({ where: { id_reserva: reservaId } });
      } catch (e) {
        console.error(
          "Error haciendo rollback de reserva tras fallo uniendo al chat:",
          e,
        );
      }
    }
    return res.status(502).send({
      status: "Error",
      message: error?.message ?? "Error al unirse al chat del trayecto",
    });
  }

  reservaId = duplicado ? reserva.id_reserva : reservaId;
  if (!isFree) {
    try {
      await prisma.reserva.update({
        where: { id_reserva: reservaId },
        data: { stripe_checkout_session_id: checkout_session.id },
      });
    } catch (e) {
      console.error(
        "Error guardando stripe_checkout_session_id en reserva:",
        e,
      );
    }
  }

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

  const newReserva = {
    id: reservaId,
    user_id: userId,
    conductorName,
    trayecto_id,
    stripe_checkout_session_id: isFree ? null : checkout_session.id,
  };
  return res.status(201).send({
    status: "Success",
    message: isFree
      ? "Reserva creada y confirmada correctamente (trayecto gratuito)"
      : "Reserva creada correctamente",
    reserva: newReserva,
    stripe_url: isFree ? null : checkout_session.url,
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
    where: { id_trayecto: travelId, NOT: { status: "canceled" } },
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

  if (String(userId) !== String(userIdParam)) {
    console.log(typeof userId, userIdParam);
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para ver las reservas de este usuario",
    });
  }

  let pasajerosList = await prisma.reserva.findMany({
    where: { user_id: userId },
  });
  if (pasajerosList.length === 0) {
    return res.status(200).send({
      status: "Success",
      message: "No se ha encontrado este trayecto o todavia no tiene reservas",
      pasajerosList,
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
    pasajerosList,
  });
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

  if (String(reserva.status ?? "").toLowerCase() === "canceled") {
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
        data: { status: "canceled" },
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

  if (String(reserva.status).toLowerCase() !== "completed") {
    return res.status(409).send({
      status: "Error",
      message: "La reserva todavía no está pagada/completada",
    });
  }

  const outcome = String(reserva.trip_outcome ?? "pending").toLowerCase();
  if (outcome === "success") {
    return res
      .status(200)
      .send({ status: "Success", message: "Viaje ya confirmado como exitoso" });
  }
  if (outcome === "issue") {
    return res.status(409).send({
      status: "Error",
      message: "Esta reserva está marcada con incidencia/reclamación",
    });
  }

  if (String(reserva.trayecto_status ?? "").toLowerCase() !== "finalizado") {
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
        trip_outcome: "success",
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
    "UPDATE reservas SET trip_outcome = 'success', trip_outcome_reason = NULL, trip_outcome_at = NOW(), stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?), stripe_payment_intent_status = COALESCE(stripe_payment_intent_status, 'captured') WHERE id_reserva = ?",
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

  const outcome = String(reserva.trip_outcome ?? "pending").toLowerCase();
  if (outcome === "success") {
    return res.status(409).send({
      status: "Error",
      message: "El viaje ya fue confirmado como exitoso",
    });
  }

  await prisma.$executeRawUnsafe(
    "UPDATE reservas SET trip_outcome = 'issue', trip_outcome_reason = ?, trip_outcome_at = NOW() WHERE id_reserva = ?",
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
          precio: true,
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

  if (reserva.status !== "pending") {
    return res.status(400).send({
      status: "Error",
      message: "Solo se puede retomar el pago de reservas pendientes",
    });
  }

  const trayecto = reserva.Trayecto;
  const isFree = Number(trayecto.precio) === 0;
  if (isFree) {
    return res.status(400).send({
      status: "Error",
      message: "Esta reserva es de un trayecto gratuito, no requiere pago",
    });
  }

  const { token, headers } = getAuthHeaders(req);
  if (!token) {
    return res.status(401).send({
      status: "Error",
      message: "No se proporcionó un token de acceso",
    });
  }

  const cookieHeaderValue = `access_token=${token}`;
  let totalAmount = trayecto.precio * 100;

  let checkout_session = null;
  let usedFallback = false;

  // 1) Intentar retomar la sesión de pago existente
  try {
    checkout_session = await fetch(
      `${USUARIOS_URL}/api/payment/payment-intent/resume`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeaderValue,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_reserva: reserva.id_reserva,
          return_url: return_url || undefined,
        }),
      },
    ).then(async (response) => {
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const err = new Error(
          errBody?.message ?? "Error al retomar el pago en Stripe",
        );
        err.status = response.status;
        err.code = errBody?.code;
        throw err;
      }
      return await response.json();
    });
  } catch (resumeError) {
    console.warn(
      "No se pudo retomar la sesión de pago, generando una nueva:",
      resumeError.message,
    );

    // 2) Fallback: crear una nueva sesión de checkout
    try {
      checkout_session = await fetch(
        `${USUARIOS_URL}/api/payment/payment-intent/checkout`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeaderValue,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: totalAmount,
            recipient_user_id: String(trayecto.conductor),
            currency: "eur",
            description:
              "Reserva de trayecto: " +
              reserva.id_trayecto +
              " desde " +
              trayecto.origen +
              " hasta " +
              trayecto.destino,
            success_url: frontend_url + "/trayecto/" + reserva.id_trayecto,
            cancel_url: frontend_url + "/trayecto/" + reserva.id_trayecto,
            trayecto_id: reserva.id_trayecto,
            id_reserva: reserva.id_reserva,
          }),
        },
      ).then(async (response) => {
        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          const err = new Error(
            errBody?.message ?? "Error al crear el PaymentIntent en Stripe",
          );
          err.status = response.status;
          err.code = errBody?.code;
          throw err;
        }
        return await response.json();
      });
      usedFallback = true;
    } catch (checkoutError) {
      const status = checkoutError.status || 400;
      return res.status(status).send({
        status: "Error",
        code: checkoutError.code,
        message: checkoutError.message,
      });
    }
  }

  try {
    await prisma.reserva.update({
      where: { id_reserva: reserva.id_reserva },
      data: { stripe_checkout_session_id: checkout_session.id },
    });
  } catch (e) {
    console.error("Error guardando stripe_checkout_session_id en reserva:", e);
  }

  return res.status(200).send({
    status: "Success",
    message: usedFallback
      ? "Nueva sesión de pago generada correctamente"
      : "Pago retomado correctamente",
    stripe_url: checkout_session.url,
    stripe_checkout_session_id: checkout_session.id,
  });
}

async function actualizarStatusReserva(req, res) {
  const { id } = req.params;
  const { status, payment_intent_id } = req.body;
  console.log()
  const VALID_STATUSES = ["pending", "completed", "canceled"];

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
      precio: true,
      status: true,
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
    return res
      .status(400)
      .send({
        status: "Error",
        message: "El conductor no puede reservar su propio trayecto",
      });
  }

  if (trayecto.disponible <= 0) {
    return res
      .status(400)
      .send({
        status: "Error",
        message: "El trayecto no tiene asientos libres",
      });
  }

  const existing = await prisma.reserva.findUnique({
    where: {
      user_id_id_trayecto: { user_id: userId, id_trayecto: trayecto_id },
    },
  });

  let reservaId;

  try {
    await prisma.$transaction(async (tx) => {
      if (existing) {
        if (existing.status === "canceled") {
          reservaId = existing.id_reserva;
          await tx.reserva.update({
            where: { id_reserva: reservaId },
            data: { status: "completed" },
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
            status: "completed",
          },
        });
      }

      await tx.trayecto.update({
        where: { id: trayecto_id },
        data: { disponible: { decrement: 1 } },
      });

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
    });
  } catch (error) {
    console.error("Error en reservaQR:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error al procesar la reserva QR" });
  }

  return res.status(201).send({
    status: "Success",
    message: "Reserva creada y recogida registrada correctamente",
    reserva: {
      id: reservaId,
      user_id: userId,
      trayecto_id,
      status: "completed",
    },
  });
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
};
