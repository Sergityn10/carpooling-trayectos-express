import dotenv from "dotenv";
import Stripe from "stripe";
import { database } from "../database.js";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function stripeWebhook(req, res) {
  if (!stripeWebhookSecret) {
    return res.status(500).send({
      status: "Error",
      message: "STRIPE_WEBHOOK_SECRET no configurado",
    });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res
      .status(400)
      .send({ status: "Error", message: "Falta stripe-signature" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      stripeWebhookSecret,
    );
  } catch (err) {
    return res
      .status(400)
      .send({ status: "Error", message: err?.message ?? "Firma inválida" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event);
        break;
      default:
        break;
    }
  } catch (err) {
    return res.status(500).send({
      status: "Error",
      message: err?.message ?? "Error procesando webhook",
    });
  }

  return res.status(200).send({ received: true });
}

async function handleCheckoutSessionCompleted(event) {
  const session = event?.data?.object;
  if (!session?.id) return;

  const connection = await database.getConnection();

  let reserva = await connection.query(
    "SELECT id_reserva, id_trayecto, username, status, stripe_checkout_session_id FROM reservas WHERE stripe_checkout_session_id = ?",
    [session.id],
  );
  reserva = reserva[0]?.[0];
  if (!reserva) return;
  if (String(reserva.status).toLowerCase() === "completed") return;

  const amount = session.amount_total ?? null;
  const currency = session.currency ?? null;
  const paymentIntentId = session.payment_intent ?? null;
  const paymentStatus = session.payment_status ?? null;

  try {
    await connection.query(
      "INSERT INTO pagos (stripe_checkout_session_id, stripe_payment_intent_id, payment_status, amount, currency, username, id_trayecto, stripe_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        session.id,
        paymentIntentId,
        paymentStatus,
        amount,
        currency,
        reserva.username,
        reserva.id_trayecto,
        event.id,
      ],
    );
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
  }

  const [result] = await connection.query(
    "UPDATE reservas SET status = ? WHERE id_reserva = ?",
    ["completed", reserva.id_reserva],
  );
  if (result?.affectedRows === 0) {
    throw new Error("No se pudo actualizar la reserva a completed");
  }
}

async function handleCheckoutSessionExpired(event) {
  const session = event?.data?.object;
  if (!session?.id) return;

  const connection = await database.getConnection();

  let reserva = await connection.query(
    "SELECT id_reserva, id_trayecto, username, status, stripe_checkout_session_id FROM reservas WHERE stripe_checkout_session_id = ?",
    [session.id],
  );
  reserva = reserva[0]?.[0];
  if (!reserva) return;
  if (String(reserva.status).toLowerCase() === "completed") return;

  await connection.query(
    "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
    [reserva.id_trayecto],
  );
  await connection.query(
    "UPDATE reservas SET status = ? WHERE id_reserva = ?",
    ["canceled", reserva.id_reserva],
  );
}

export const WebhooksController = {
  stripeWebhook,
};
