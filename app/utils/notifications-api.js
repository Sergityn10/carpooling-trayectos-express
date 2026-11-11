import dotenv from "dotenv";

dotenv.config();

const DEFAULT_TIMEOUT_MS = 10000;
const BATCH_TIMEOUT_MS = 4000;

function getNotificationsBaseUrl() {
  return (
    process.env.NOTIFICATIONS_SERVICE_URL ||
    process.env.NOTIFICATIONS_URL ||
    "http://localhost:3004"
  );
}

async function _post(
  path,
  body,
  { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {},
) {
  const url = `${getNotificationsBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let json;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const detail =
        json?.error || json?.detail || json?.message || "Unknown error";
      throw new Error(`Notifications API error ${res.status}: ${detail}`);
    }

    return json;
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(
        `Notifications API timeout (${timeoutMs}ms) calling ${url}`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmail({ to, subject, html, text, cc, bcc, replyTo }) {
  const body = { to, subject, html, text, cc, bcc, replyTo };
  return _post("/api/emails/send", body);
}

async function sendTemplatedEmail({ to, template, data, cc, bcc, replyTo }) {
  const body = { to, template, data, cc, bcc, replyTo };
  return _post("/api/emails/send/template", body);
}

async function sendBatchEmails(emails) {
  return _post("/api/emails/send/batch", { emails });
}

async function sendSuggestionEmail({
  companyName,
  companyEmail,
  userName,
  userEmail,
  suggestionId,
  website,
}) {
  const body = {
    companyName,
    companyEmail,
    userName,
    userEmail,
    suggestionId,
    website,
  };
  return _post("/api/emails/send/suggestion", body);
}

async function sendPushToUser({
  userId,
  title,
  body: bodyText,
  data = {},
  priority,
  channelId,
  badge,
}) {
  const body = {
    userId,
    title,
    body: bodyText,
    data,
    priority,
    channelId,
    badge,
  };
  return _post("/api/push/send/user", body);
}

async function sendPushToToken({
  token,
  title,
  body: bodyText,
  data = {},
  priority,
  channelId,
  badge,
}) {
  const body = {
    token,
    title,
    body: bodyText,
    data,
    priority,
    channelId,
    badge,
  };
  return _post("/api/push/send", body);
}

async function sendPushToTopic({
  topic,
  title,
  body: bodyText,
  data = {},
  priority,
}) {
  const body = { topic, title, body: bodyText, data, priority };
  return _post("/api/push/send/topic", body);
}

async function subscribeToTopic({ tokens, topic }) {
  return _post("/api/push/topic/subscribe", { tokens, topic });
}

async function unsubscribeFromTopic({ tokens, topic }) {
  return _post("/api/push/topic/unsubscribe", { tokens, topic });
}

async function sendPushMulticast({
  tokens,
  title,
  body: bodyText,
  data = {},
  priority,
  channelId,
  badge,
}) {
  const body = {
    tokens,
    title,
    body: bodyText,
    data,
    priority,
    channelId,
    badge,
  };
  return _post("/api/push/send/multicast", body);
}

async function sendPushTemplatedToUser({
  userId,
  template,
  data,
  priority,
  channelId,
  badge,
}) {
  const body = { userId, template, data, priority, channelId, badge };
  return _post("/api/push/send/template/user", body);
}

/**
 * Envía una notificación batch a carpooling-notifications (HTTP fallback).
 */
async function sendBatchNotification(
  { idempotencyKey, type, channels, priority, sharedData, userIds },
  { timeoutMs = BATCH_TIMEOUT_MS } = {},
) {
  const apiKey = process.env.INTERNAL_SERVICE_API_KEY || "";
  const headers = {
    "X-Service-Api-Key": apiKey,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };

  return _post(
    "/api/notifications/batch",
    {
      idempotencyKey,
      type,
      channels,
      priority,
      sharedData,
      userIds,
    },
    { timeoutMs, headers },
  );
}

export const NotificationsAPI = {
  sendEmail,
  sendTemplatedEmail,
  sendBatchEmails,
  sendSuggestionEmail,
  sendPushToUser,
  sendPushToToken,
  sendPushToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendPushMulticast,
  sendPushTemplatedToUser,
  sendBatchNotification,
};
