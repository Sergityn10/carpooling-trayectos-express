import { database } from "../database.js";
import { UsersAPI } from "../utils/users-api.js";
import { NotificationsAPI } from "./notifications-api.js";
import { TRAYECTO_STATUS, RESERVA_STATUS } from "../constants/statuses.js";

async function getUserEmailById(userId) {
  if (!userId) return null;
  return await UsersAPI.fetchUserEmail(String(userId));
}

async function notifyTrayectoEnCurso(connection, trayecto) {
  const [reservas] = await connection.query(
    `SELECT DISTINCT user_id FROM reservas WHERE id_trayecto = ? AND status != '${RESERVA_STATUS.CANCELED}'`,
    [trayecto.id],
  );

  const userIds = new Set([
    trayecto.conductor,
    ...(reservas ?? []).map((r) => r.user_id),
  ]);

  const [trayectoRows] = await connection.query(
    "SELECT hora, plazas, disponible FROM trayectos WHERE id = ?",
    [trayecto.id],
  );
  const trayectoFull = trayectoRows?.[0];
  const passengers = (reservas ?? []).length;
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

  const emailTasks = [];
  const pushTasks = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(uid);
    const userInfo = await UsersAPI.fetchUserPublicInfo(String(uid));
    const userName = userInfo?.name || "";

    if (email) {
      emailTasks.push(
        NotificationsAPI.sendTemplatedEmail({
          to: email,
          template: "trip_started",
          data: {
            userName,
            origin: trayecto.origen,
            destination: trayecto.destino,
            date: dateStr,
            time: timeStr,
            passengers,
            tripId: trayecto.id,
          },
        }).catch((e) =>
          console.error("Error email trip_started:", e?.message ?? e),
        ),
      );
    }

    pushTasks.push(
      NotificationsAPI.sendPushTemplatedToUser({
        userId: String(uid),
        template: "trip_started",
        data: {
          userName,
          origin: trayecto.origen,
          destination: trayecto.destino,
          tripId: trayecto.id,
        },
        priority: "high",
      }).catch((e) =>
        console.error("Error push trip_started:", e?.message ?? e),
      ),
    );
  }

  if (emailTasks.length === 0 && pushTasks.length === 0) return;

  await Promise.allSettled(emailTasks);
  await Promise.allSettled(pushTasks);
}

async function notifyTrayectoFinalizado(connection, trayecto) {
  const [reservas] = await connection.query(
    `SELECT DISTINCT user_id FROM reservas WHERE id_trayecto = ? AND status != '${RESERVA_STATUS.CANCELED}'`,
    [trayecto.id],
  );

  const userIds = new Set([
    trayecto.conductor,
    ...(reservas ?? []).map((r) => r.user_id),
  ]);

  const [trayectoRows] = await connection.query(
    "SELECT hora, precio FROM trayectos WHERE id = ?",
    [trayecto.id],
  );
  const trayectoFull = trayectoRows?.[0];
  const passengers = (reservas ?? []).length;
  const earnings = (trayectoFull?.precio ?? 0) * passengers;
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

  const emailTasks = [];
  const pushTasks = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(uid);
    const userInfo = await UsersAPI.fetchUserPublicInfo(String(uid));
    const userName = userInfo?.name || "";

    if (email) {
      emailTasks.push(
        NotificationsAPI.sendTemplatedEmail({
          to: email,
          template: "trip_completed",
          data: {
            userName,
            origin: trayecto.origen,
            destination: trayecto.destino,
            date: dateStr,
            time: timeStr,
            passengers,
            earnings,
            tripId: trayecto.id,
          },
        }).catch((e) =>
          console.error("Error email trip_completed:", e?.message ?? e),
        ),
      );
    }

    pushTasks.push(
      NotificationsAPI.sendPushTemplatedToUser({
        userId: String(uid),
        template: "trip_completed",
        data: {
          userName,
          origin: trayecto.origen,
          destination: trayecto.destino,
          tripId: trayecto.id,
        },
        priority: "high",
      }).catch((e) =>
        console.error("Error push trip_completed:", e?.message ?? e),
      ),
    );
  }

  if (emailTasks.length === 0 && pushTasks.length === 0) return;

  await Promise.allSettled(emailTasks);
  await Promise.allSettled(pushTasks);
}

async function tick() {
  const connection = await database.getConnection();

  const [toStart] = await connection.query(
    `SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = '${TRAYECTO_STATUS.PROGRAMADO}' AND hora <= NOW()`,
  );

  for (const trayecto of toStart ?? []) {
    const [result] = await connection.query(
      `UPDATE trayectos SET status = '${TRAYECTO_STATUS.EN_CURSO}' WHERE id = ? AND status = '${TRAYECTO_STATUS.PROGRAMADO}'`,
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
    `SELECT id, origen, destino, hora, conductor FROM trayectos WHERE status = '${TRAYECTO_STATUS.EN_CURSO}' AND DATE_ADD(hora, INTERVAL 2 DAY) <= NOW()`,
  );

  for (const trayecto of toFinalize ?? []) {
    const [result] = await connection.query(
      `UPDATE trayectos SET status = '${TRAYECTO_STATUS.FINALIZADO}' WHERE id = ? AND status = '${TRAYECTO_STATUS.EN_CURSO}'`,
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
