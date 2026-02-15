import { ReservaSchema } from "../schemas/reserva.js";
import { database } from "../database.js";
import dotenv from "dotenv";
import { methods as cryptoMethods } from "../utils/crypto.js";

import Stripe from "stripe";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;
const MESSAGES_URL = process.env.MESSAGES_URL;
let frontend_url = process.env.FRONTEND_URL;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getRatedTrayectoIdsForUser(connection, userId, trayectoIds) {
  if (!userId) return new Set();
  const ids = (trayectoIds ?? [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (ids.length === 0) return new Set();

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT DISTINCT id_trayecto FROM comments WHERE user_id_commentator = ? AND id_trayecto IN (${placeholders})`,
    [userId, ...ids],
  );
  return new Set(
    (rows ?? [])
      .map((r) => Number(r.id_trayecto))
      .filter((x) => Number.isFinite(x)),
  );
}

async function getRatedUserIdsForTrayecto(connection, trayectoId, userIds) {
  const id = Number(trayectoId);
  if (!Number.isFinite(id)) return new Set();

  const users = (userIds ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  if (users.length === 0) return new Set();

  const placeholders = users.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT DISTINCT user_id_commentator FROM comments WHERE id_trayecto = ? AND user_id_commentator IN (${placeholders})`,
    [id, ...users],
  );
  return new Set((rows ?? []).map((r) => r.user_id_commentator));
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

async function getReservaWithTrayecto(connection, idReserva) {
  const [rows] = await connection.query(
    "SELECT r.*, t.conductor AS conductor, t.status AS trayecto_status FROM reservas r JOIN trayectos t ON t.id = r.id_trayecto WHERE r.id_reserva = ?",
    [idReserva],
  );
  return rows?.[0] ?? null;
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
  const connection = await database.getConnection();

  let trayecto = await connection.query(
    "SELECT disponible, precio,origen,conductor, destino FROM trayectos WHERE id = ?",
    [trayecto_id],
  );
  if (trayecto[0].length === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Trayecto no encontrado" });
  }
  trayecto = trayecto[0][0];

  // Obtener el user_id del conductor usando su ID para buscar la cuenta de Stripe
  const [conductorRows] = await connection.query(
    "SELECT name FROM users WHERE id = ?",
    [trayecto.conductor],
  );
  if (conductorRows.length === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Conductor no encontrado" });
  }
  const conductorName = conductorRows[0].name;

  let user = await connection.query("SELECT * FROM users WHERE id = ?", [
    userId,
  ]);
  if (user[0].length === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "Usuario no encontrado" });
  }
  let stripe_account = await connection.query(
    "SELECT stripe_account_id FROM accounts WHERE user_id = ?",
    [trayecto.conductor],
  );
  try {
    stripe_account = stripe_account[0][0].stripe_account_id;
  } catch (error) {
    stripe_account = await connection.query(
      "SELECT stripe_account FROM users WHERE id = ?",
      [trayecto.conductor],
    );
    stripe_account = stripe_account[0][0].stripe_account;
  }
  user = user[0][0];

  const cookieHeaderValue = `access_token=${token}`; // El formato debe ser 'nombre=valor'
  console.log(`Cookie: ${cookieHeaderValue}`);
  let reserva = {
    user_id: userId,
    trayecto_id,
    status: "pending",
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
  let result = null;
  let duplicado = false;
  let reservaId = null;
  try {
    [result] = await connection.query(
      "INSERT INTO reservas (user_id, id_trayecto, status) VALUES (?, ?, ?)",
      [userId, trayecto_id, reserva.status],
    );
    reservaId = result?.insertId ?? null;
  } catch (error) {
    switch (error.code) {
      case "ER_NO_REFERENCED_ROW_2":
        return res.status(400).send({
          status: "Error",
          message: "El usuario o trayecto no existen",
        });
        break;
      case "ER_DUP_ENTRY":
        duplicado = true;
        // return res.status(400).send({ status: "Error", message: "El usuario ya tiene una reserva para este trayecto" });
        reserva = await connection.query(
          "SELECT * FROM reservas WHERE user_id = ? AND id_trayecto = ?",
          [userId, trayecto_id],
        );
        if (reserva[0][0].status === "completed") {
          return res.status(400).send({
            status: "Error",
            message: "El usuario ya tiene una reserva para este trayecto",
          });
        }
        reserva = reserva[0][0];
        reservaId = reserva.id_reserva;
        break;
      default:
        return res
          .status(500)
          .send({ status: "Error", message: "Error al crear la reserva" });
        break;
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
        await connection.query("DELETE FROM reservas WHERE id_reserva = ?", [
          reservaId,
        ]);
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

  // Unirse al chat del trayecto
  let totalAmount = trayecto.precio * 100;
  let checkout_session;
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
          destination: stripe_account,
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
          id_reserva: duplicado ? reserva.id_reserva : result.insertId,
        }),
      },
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error("Error al crear el PaymentIntent en Stripe");
      }
      return await response.json();
    });
  } catch (error) {
    return res.status(400).send({
      status: "Error",
      message: error.message,
    });
  }
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
        await connection.query("DELETE FROM reservas WHERE id_reserva = ?", [
          reservaId,
        ]);
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

  reservaId = duplicado ? reserva.id_reserva : result.insertId;
  try {
    await connection.query(
      "UPDATE reservas SET stripe_checkout_session_id = ? WHERE id_reserva = ?",
      [checkout_session.id, reservaId],
    );
  } catch (e) {
    console.error("Error guardando stripe_checkout_session_id en reserva:", e);
  }

  const newReserva = {
    id: reservaId,
    user_id: userId,
    conductorName,
    trayecto_id,
    stripe_checkout_session_id: checkout_session.id,
  };
  return res.status(201).send({
    status: "Success",
    message: "Reserva creada correctamente",
    reserva: newReserva,
    stripe_url: checkout_session.url,
  });
}

async function getReservasByTravelId(req, res) {
  const { travelId } = req.params;
  const connection = await database.getConnection();
  const trayecto = await connection.query(
    "SELECT * FROM trayectos WHERE id = ?",
    [travelId],
  );
  if (trayecto[0].length === 0) {
    return res
      .status(404)
      .send({ status: "Error", message: "No se ha encontrado este trayecto" });
  }
  let pasajerosList = await connection.query(
    "SELECT * FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
    [travelId],
  );
  pasajerosList = pasajerosList[0];
  //Agregar info adicional como la img_perfil y el nombre
  if (pasajerosList.length === 0 || pasajerosList.affectedRows === 0) {
    return res.status(200).send({
      status: "Success",
      message: "No se ha encontrado este trayecto o todavia no tiene reservas",
      pasajerosList: [],
    });
  }
  pasajerosList = await Promise.all(
    pasajerosList.map(async (pasajero) => {
      const [userRows] = await connection.query(
        "SELECT name, img_perfil FROM users WHERE id = ?",
        [pasajero.user_id],
      );
      const userDecrypted = cryptoMethods.decryptFields(userRows[0], ["name"]);

      // Fetch user preferences
      const [preferenceRows] = await connection.query(
        "SELECT * FROM user_preferences WHERE user_id = ?",
        [pasajero.user_id],
      );
      const preferences = preferenceRows[0] || {};

      return {
        ...pasajero,
        img_perfil: userDecrypted?.img_perfil,
        nombre: userDecrypted?.name,
        preferences: preferences, // Add preferences property
      };
    }),
  );

  const ratedUsernames = await getRatedUserIdsForTrayecto(
    connection,
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

  if (userId !== Number(userIdParam)) {
    console.log(typeof user.id, userIdParam);
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para ver las reservas de este usuario",
    });
  }

  const connection = await database.getConnection();
  let pasajerosList = await connection.query(
    "SELECT * FROM reservas WHERE user_id = ?",
    [userId],
  );
  if (pasajerosList[0].length === 0) {
    return res.status(200).send({
      status: "Success",
      message: "No se ha encontrado este trayecto o todavia no tiene reservas",
      pasajerosList: pasajerosList[0],
    });
  }
  pasajerosList = pasajerosList[0];

  const ratedTrayectoIds = await getRatedTrayectoIdsForUser(
    connection,
    userId,
    pasajerosList.map((r) => r.id_trayecto),
  );
  pasajerosList = pasajerosList.map((r) => ({
    ...r,
    valorado: ratedTrayectoIds.has(Number(r.id_trayecto)),
  }));

  pasajerosList = await Promise.all(
    pasajerosList.map(async (reserva) => {
      const [trayectoRows] = await connection.query(
        "SELECT * FROM trayectos WHERE id = ?",
        [reserva.id_trayecto],
      );
      const trayecto = trayectoRows[0];

      const [userRows] = await connection.query(
        "SELECT img_perfil, name FROM users WHERE id = ?",
        [trayecto.conductor],
      );

      const conductorUser = cryptoMethods.decryptFields(userRows[0], ["name"]);
      const conductorId = trayecto.conductor;
      trayecto.conductor = conductorUser?.name || "Desconocido";
      trayecto.conductor_id = conductorId;
      trayecto.img_perfil = conductorUser?.img_perfil;

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
  const idReserva = Number(id);
  if (!Number.isFinite(idReserva) || idReserva <= 0) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de reserva inválido" });
  }

  if (!USUARIOS_URL) {
    return res
      .status(500)
      .send({ status: "Error", message: "USUARIOS_URL no configurado" });
  }

  const connection = await database.getConnection();
  const reserva = await getReservaWithTrayecto(connection, idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  if (String(reserva.status ?? "").toLowerCase() === "canceled") {
    return res
      .status(200)
      .send({ status: "Success", message: "Reserva cancelada correctamente" });
  }

  let paymentIntentId = reserva.stripe_payment_intent_id ?? null;
  if (!paymentIntentId && reserva.stripe_checkout_session_id) {
    const [rows] = await connection.query(
      "SELECT stripe_payment_intent_id FROM pagos WHERE stripe_checkout_session_id = ? AND stripe_payment_intent_id IS NOT NULL ORDER BY id DESC LIMIT 1",
      [reserva.stripe_checkout_session_id],
    );
    paymentIntentId = rows?.[0]?.stripe_payment_intent_id ?? null;
    if (paymentIntentId) {
      await connection.query(
        "UPDATE reservas SET stripe_payment_intent_id = ? WHERE id_reserva = ?",
        [paymentIntentId, idReserva],
      );
    }
  }

  if (paymentIntentId) {
    const { token, headers } = getAuthHeaders(req);
    if (!token) {
      return res.status(401).send({
        status: "Error",
        message: "No se proporcionó un token de acceso",
      });
    }

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
        const msg = body?.message ?? "Error cancelando el PaymentIntent";
        return res
          .status(502)
          .send({ status: "Error", message: msg, details: body ?? undefined });
      }
    } catch (e) {
      return res.status(502).send({
        status: "Error",
        message: e?.message ?? "Error llamando a Users API",
      });
    }
  }

  try {
    await connection.query("BEGIN");

    const [result] = await connection.query(
      "UPDATE reservas SET status = 'canceled' WHERE id_reserva = ?",
      [idReserva],
    );
    if (result.affectedRows === 0) {
      await connection.query("ROLLBACK");
      return res
        .status(404)
        .send({ status: "Error", message: "Reserva no encontrada" });
    }

    await connection.query(
      "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
      [reserva.id_trayecto],
    );

    await connection.query("COMMIT");
  } catch (e) {
    try {
      await connection.query("ROLLBACK");
    } catch (_) {
      // ignore
    }
    return res.status(500).send({
      status: "Error",
      message: e?.message ?? "Error cancelando la reserva",
    });
  }

  return res
    .status(200)
    .send({ status: "Success", message: "Reserva cancelada correctamente" });
}

async function confirmarViajeExitoso(req, res) {
  const { id } = req.params;
  const idReserva = Number(id);
  if (!Number.isFinite(idReserva) || idReserva <= 0) {
    return res
      .status(400)
      .send({ status: "Error", message: "id de reserva inválido" });
  }

  if (!USUARIOS_URL) {
    return res
      .status(500)
      .send({ status: "Error", message: "USUARIOS_URL no configurado" });
  }

  const connection = await database.getConnection();
  const reserva = await getReservaWithTrayecto(connection, idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  const userId = req.user?.userId;
  const isAllowed = userId && userId !== reserva.conductor;
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

  let paymentIntentId = reserva.stripe_payment_intent_id ?? null;
  if (!paymentIntentId && reserva.stripe_checkout_session_id) {
    const [rows] = await connection.query(
      "SELECT stripe_payment_intent_id FROM pagos WHERE stripe_checkout_session_id = ? AND stripe_payment_intent_id IS NOT NULL ORDER BY id DESC LIMIT 1",
      [reserva.stripe_checkout_session_id],
    );
    //ACTUALIZAR LA RESERVA
    paymentIntentId = rows?.[0]?.stripe_payment_intent_id ?? null;
    if (paymentIntentId) {
      await connection.query(
        "UPDATE reservas SET stripe_payment_intent_id = ? WHERE id_reserva = ?",
        [paymentIntentId, idReserva],
      );
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

  await connection.query(
    "UPDATE reservas SET trip_outcome = 'success', trip_outcome_reason = NULL, trip_outcome_at = datetime('now'), stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?), stripe_payment_intent_status = COALESCE(stripe_payment_intent_status, 'captured') WHERE id_reserva = ?",
    [paymentIntentId, idReserva],
  );

  return res.status(200).send({
    status: "Success",
    message: "Viaje confirmado y pago capturado correctamente",
    capture: captureResponse,
  });
}

async function reclamarViaje(req, res) {
  const { id } = req.params;
  const idReserva = Number(id);
  if (!Number.isFinite(idReserva) || idReserva <= 0) {
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

  const connection = await database.getConnection();
  const reserva = await getReservaWithTrayecto(connection, idReserva);
  if (!reserva) {
    return res
      .status(404)
      .send({ status: "Error", message: "Reserva no encontrada" });
  }

  const userId = req.user?.id;
  const isAllowed = userId && userId === reserva.conductor;
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

  await connection.query(
    "UPDATE reservas SET trip_outcome = 'issue', trip_outcome_reason = ?, trip_outcome_at = datetime('now') WHERE id_reserva = ?",
    [reason, idReserva],
  );

  return res
    .status(200)
    .send({ status: "Success", message: "Reclamación registrada" });
}
export const ReservaController = {
  addReserva,
  deleteReserva,
  getReservasByTravelId,
  obtenerMisReservas,
  confirmarViajeExitoso,
  reclamarViaje,
};
