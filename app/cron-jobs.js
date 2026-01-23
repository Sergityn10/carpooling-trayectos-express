import cron from "node-cron";
import { database } from "./database.js";
import { sendTrayectoAPuntoDeComenzar } from "./utils/mailer.js";

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

    const passengerUsernames = (reservas ?? [])
      .map((r) => r.username)
      .filter(Boolean)
      .filter((u) => u !== trayecto.conductor);

    if (passengerUsernames.length === 0) continue;

    const emails = [];
    for (const username of new Set(passengerUsernames)) {
      const email = await getUserEmail(connection, username);
      if (email) emails.push(email);
    }

    if (emails.length === 0) continue;

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

    await connection.query(
      "UPDATE trayectos SET notified_15min = 1 WHERE id = ? AND (notified_15min IS NULL OR notified_15min = 0)",
      [trayecto.id]
    );
  }
}

export function startTrayectoSoonReminderCron({ schedule = "*/5 * * * *" } = {}) {
  let running = false;

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