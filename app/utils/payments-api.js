import dotenv from "dotenv";

dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;

async function createCheckoutSession(payload, { headers = {} } = {}) {
  if (!USUARIOS_URL) {
    throw new Error("USUARIOS_URL no configurado");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `${USUARIOS_URL}/api/payment/payment-intent/checkout`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        body?.message ?? body?.error ?? `Error ${res.status} en checkout`;
      throw new Error(msg);
    }

    return {
      checkout_session_id: body.checkout_session_id ?? null,
      checkout_url: body.checkout_url ?? null,
      payment_intent_id: body.payment_intent_id ?? null,
      pricing: body.pricing ?? null,
    };
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      throw new Error("Timeout al crear sesión de checkout");
    }
    throw e;
  }
}

async function resumePaymentSession(payload, { headers = {} } = {}) {
  if (!USUARIOS_URL) {
    throw new Error("USUARIOS_URL no configurado");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `${USUARIOS_URL}/api/payment/payment-intent/resume`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        body?.message ?? body?.error ?? `Error ${res.status} al reanudar pago`;
      throw new Error(msg);
    }

    return {
      checkout_session_id: body.checkout_session_id ?? null,
      checkout_url: body.checkout_url ?? null,
      payment_intent_id: body.payment_intent_id ?? null,
      pricing: body.pricing ?? null,
    };
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      throw new Error("Timeout al reanudar pago");
    }
    throw e;
  }
}

export const PaymentsAPI = {
  createCheckoutSession,
  resumePaymentSession,
};
