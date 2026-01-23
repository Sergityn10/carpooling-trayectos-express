import cron from "node-cron";
import { database } from "./database.js";
import { sendTrayectoAPuntoDeComenzar, sendTrayectoEnCursoEmail } from "./utils/mailer.js";

async function getUserEmail(connection, username) {
  if (!username) return null;
  try {
    const [rows] = await connection.query("SELECT email FROM users WHERE username = ?", [username]);
    const email = rows?.[0]?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  } catch {
    return null;
  }
}

async function notifyTrayectoEnCurso(connection, trayecto) {
  const [reservas] = await connection.query(
    "SELECT DISTINCT username FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
    [trayecto.id]
  );

  const usernames = new Set([trayecto.conductor, ...(reservas ?? []).map((r) => r.username)]);
  const emails = [];

  for (const username of usernames) {
    const email = await getUserEmail(connection, username);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  const results = await Promise.allSettled(
    emails.map((to) =>
      sendTrayectoEnCursoEmail({
        to,
        trayecto
      })
    )
  );

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("Error enviando emails de trayecto en curso:", r.reason);
    }
  }
}

async function tickTrayectoStatusAndNotify() {
  const connection = await database.getConnection();

  const [toStart] = await connection.query(
    "SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = 'programado' AND datetime(hora) <= datetime('now')"
  );

  for (const trayecto of toStart ?? []) {
    const [result] = await connection.query(
      "UPDATE trayectos SET status = 'en curso' WHERE id = ? AND status = 'programado'",
      [trayecto.id]
    );

    if (result?.affectedRows > 0) {
      try {
        await notifyTrayectoEnCurso(connection, trayecto);
      } catch (e) {
        console.error("Error enviando emails de trayecto en curso:", e);
      }
    }
  }

  await connection.query(
    "UPDATE trayectos SET status = 'finalizado' WHERE status = 'en curso' AND datetime(hora, '+10 minutes') <= datetime('now')"
  );
}

async function tickTrayectosAPuntoDeComenzar() {
  const connection = await database.getConnection();

  const [trayectos] = await connection.query(
    "SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = 'programado' AND (notified_15min IS NULL OR notified_15min = 0) AND datetime(hora) > datetime('now') AND datetime(hora) <= datetime('now', '+15 minutes')"
  );

  for (const trayecto of trayectos ?? []) {
    const [reservas] = await connection.query(
      "SELECT DISTINCT username FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
      [trayecto.id]
    );

    const usernames = new Set([trayecto.conductor, ...(reservas ?? []).map((r) => r.username)]);
    const emails = [];

    for (const username of usernames) {
      const email = await getUserEmail(connection, username);
      if (email) emails.push(email);
    }

    if (emails.length > 0) {
      const results = await Promise.allSettled(
        emails.map((to) =>
          sendTrayectoAPuntoDeComenzar({
            to,
            trayecto
          })
        )
      );

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("Error enviando email de trayecto a punto de comenzar:", r.reason);
        }
      }
    }

    await connection.query(
      "UPDATE trayectos SET notified_15min = 1 WHERE id = ? AND (notified_15min IS NULL OR notified_15min = 0)",
      [trayecto.id]
    );
  }
}

export function startTrayectoSoonReminderCron({ schedule = "*/5 * * * *" } = {}) {
  let running = false;
  console.log("Entro ene le trayectos Status Cron reminder soon")

  const task = cron.schedule(schedule, async () => {
    if (running) return;
    running = true;
    try {
      await tickTrayectosAPuntoDeComenzar();
    } catch (e) {
      console.error("Error en cron de recordatorio <15min:", e);
    } finally {
      running = false;
    }
  });

  task.start();
  return task;
}

export function startTrayectoStatusCron({ schedule = "*/1 * * * *" } = {}) {
  let running = false;
    console.log("Entro ene le trayectos Status Cron")
  const task = cron.schedule(schedule, async () => {

    if (running) return;
    running = true;
    try {
      await tickTrayectoStatusAndNotify();
    } catch (e) {
      console.error("Error en cron de estados de trayecto:", e);
    } finally {
      running = false;
    }
  });

  task.start();
  return task;
}