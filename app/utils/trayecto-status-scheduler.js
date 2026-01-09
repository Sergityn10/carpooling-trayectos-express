import { database } from "../database.js";
import { sendTrayectoEnCursoEmail } from "./mailer.js";

async function getUserEmail(connection, username) {
  if (!username) return null;
  try {
    const [rows] = await connection.query("SELECT email FROM users WHERE username = ?", [username]);
    const email = rows?.[0]?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  } catch (e) {
    return null;
  }
}

async function notifyTrayectoEnCurso(connection, trayecto) {
  const [reservas] = await connection.query(
    "SELECT DISTINCT username FROM reservas WHERE id_trayecto = ? AND status != 'canceled'",
    [trayecto.id]
  );

  const usernames = new Set([trayecto.conductor, ...(reservas ?? []).map(r => r.username)]);
  const emails = [];

  for (const username of usernames) {
    const email = await getUserEmail(connection, username);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  await Promise.all(
    emails.map((to) => sendTrayectoEnCursoEmail({
      to,
      trayecto
    }))
  );
}

async function tick() {
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
