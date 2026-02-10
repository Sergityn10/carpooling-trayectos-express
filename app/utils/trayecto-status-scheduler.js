import { database } from "../database.js";
import {
  sendTrayectoEnCursoEmail,
  sendTrayectoFinalizadoConfirmacionEmail,
} from "./mailer.js";

async function getUserEmailById(connection, userId) {
  if (!userId) return null;
  try {
    const [rows] = await connection.query(
      "SELECT email FROM users WHERE id = ?",
      [userId],
    );
    const email = rows?.[0]?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  } catch (e) {
    return null;
  }
}

async function notifyTrayectoEnCurso(connection, trayecto) {
  const [reservas] = await connection.query(
    "SELECT DISTINCT user_id FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
    [trayecto.id],
  );

  const userIds = new Set([
    trayecto.conductor,
    ...(reservas ?? []).map((r) => r.user_id),
  ]);
  const emails = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(connection, uid);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  await Promise.all(
    emails.map((to) =>
      sendTrayectoEnCursoEmail({
        to,
        trayecto,
      }),
    ),
  );
}

async function notifyTrayectoFinalizado(connection, trayecto) {
  const [reservas] = await connection.query(
    "SELECT DISTINCT user_id FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
    [trayecto.id],
  );

  const userIds = new Set([...(reservas ?? []).map((r) => r.user_id)]);
  const emails = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(connection, uid);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL;
  await Promise.all(
    emails.map((to) =>
      sendTrayectoFinalizadoConfirmacionEmail({
        to,
        trayecto,
        frontendUrl,
      }),
    ),
  );
}

async function tick() {
  const connection = await database.getConnection();

  const [toStart] = await connection.query(
    "SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = 'programado' AND datetime(hora) <= datetime('now')",
  );

  for (const trayecto of toStart ?? []) {
    const [result] = await connection.query(
      "UPDATE trayectos SET status = 'en curso' WHERE id = ? AND status = 'programado'",
      [trayecto.id],
    );

    if (result?.affectedRows > 0) {
      try {
        await notifyTrayectoEnCurso(connection, trayecto);
      } catch (e) {
        console.error("Error enviando emails de trayecto en curso:", e);
      }
    }
  }

  const [toFinalize] = await connection.query(
    "SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = 'en curso' AND datetime(hora, '+2 days') <= datetime('now')",
  );

  for (const trayecto of toFinalize ?? []) {
    const [result] = await connection.query(
      "UPDATE trayectos SET status = 'finalizado' WHERE id = ? AND status = 'en curso'",
      [trayecto.id],
    );

    if (result?.affectedRows > 0) {
      try {
        await notifyTrayectoFinalizado(connection, trayecto);
      } catch (e) {
        console.error("Error enviando emails de trayecto finalizado:", e);
      }
    }
  }
}

export function startTrayectoStatusScheduler({ intervalMs = 30000 } = {}) {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (e) {
      console.error("Error en scheduler de estados de trayecto:", e);
    } finally {
      running = false;
    }
  };

  run();
  return setInterval(run, intervalMs);
}
