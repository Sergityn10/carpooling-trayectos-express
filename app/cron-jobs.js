import cron from "node-cron";
import { prisma } from "./database.js";
import { UsersAPI } from "./utils/users-api.js";
import {
  sendTrayectoAPuntoDeComenzar,
  sendTrayectoEnCursoEmail,
  sendTrayectoFinalizadoConfirmacionEmail,
} from "./utils/mailer.js";

function getMessagesBaseHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = process.env.MESSAGES_SERVICE_TOKEN;
  if (typeof token === "string" && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function getUserEmailById(userId) {
  if (!userId) return null;
  return await UsersAPI.fetchUserEmail(String(userId));
}

async function deleteTrayectoChatIfExists(trayectoId) {
  const baseUrl = process.env.MESSAGES_URL;
  if (!baseUrl) return;

  const headers = getMessagesBaseHeaders();

  let chatId = null;
  try {
    const chatResponse = await fetch(
      `${baseUrl}/api/chats/trip/${trayectoId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (chatResponse.status === 404) {
      return;
    }

    const chatBody = await chatResponse.json().catch(() => null);
    if (!chatResponse.ok) {
      throw new Error(
        chatBody?.message ?? "Error obteniendo chat del trayecto",
      );
    }

    chatId = chatBody?.chat?.id ?? chatBody?.id ?? null;
  } catch (e) {
    console.error("Error obteniendo chat por trayecto para borrado:", e);
    return;
  }

  if (!chatId) return;

  try {
    const delResponse = await fetch(`${baseUrl}/api/chats/${chatId}`, {
      method: "DELETE",
      headers,
    });
    if (delResponse.ok || delResponse.status === 404) {
      return;
    }
    const body = await delResponse.json().catch(() => null);
    throw new Error(
      body?.message ?? `Error borrando chat (${delResponse.status})`,
    );
  } catch (e) {
    console.error("Error borrando chat del trayecto:", e);
  }
}

async function tickCleanupFinalizedTrayectoChats() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const trayectos = await prisma.trayecto.findMany({
    where: {
      status: "finalizado",
      hora: { lte: twoDaysAgo },
    },
    select: { id: true },
  });

  for (const t of trayectos) {
    try {
      await deleteTrayectoChatIfExists(t.id);
    } catch (e) {
      console.error("Error en limpieza de chat del trayecto:", e);
    }
  }
}

export async function notifyTrayectoEnCurso(trayecto) {
  const reservas = await prisma.reserva.findMany({
    where: {
      id_trayecto: trayecto.id,
      status: { not: "canceled" },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const userIds = new Set([
    trayecto.conductor,
    ...reservas.map((r) => r.user_id),
  ]);
  const emails = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(uid);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  const results = await Promise.allSettled(
    emails.map((to) =>
      sendTrayectoEnCursoEmail({
        to,
        trayecto,
      }),
    ),
  );

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("Error enviando emails de trayecto en curso:", r.reason);
    }
  }
}

export async function notifyTrayectoFinalizado(trayecto) {
  const reservas = await prisma.reserva.findMany({
    where: {
      id_trayecto: trayecto.id,
      status: { not: "canceled" },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const userIds = new Set([...reservas.map((r) => r.user_id)]);
  const emails = [];

  for (const uid of userIds) {
    const email = await getUserEmailById(uid);
    if (email) emails.push(email);
  }

  if (emails.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL;
  const results = await Promise.allSettled(
    emails.map((to) =>
      sendTrayectoFinalizadoConfirmacionEmail({
        to,
        trayecto,
        frontendUrl,
      }),
    ),
  );

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("Error enviando emails de trayecto finalizado:", r.reason);
    }
  }
}

async function tickTrayectoStatusAndNotify() {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const toStart = await prisma.trayecto.findMany({
    where: {
      status: "programado",
      hora: { lte: now },
    },
    select: {
      id: true,
      origen: true,
      destino: true,
      hora: true,
      conductor: true,
    },
  });

  for (const trayecto of toStart) {
    const result = await prisma.trayecto.updateMany({
      where: { id: trayecto.id, status: "programado" },
      data: { status: "en curso" },
    });

    if (result.count > 0) {
      try {
        await notifyTrayectoEnCurso(trayecto);
      } catch (e) {
        console.error("Error enviando emails de trayecto en curso:", e);
      }
    }
  }

  const toFinalize = await prisma.trayecto.findMany({
    where: {
      status: "en curso",
      hora: { lte: twoDaysAgo },
    },
    select: {
      id: true,
      origen: true,
      destino: true,
      hora: true,
      conductor: true,
    },
  });

  for (const trayecto of toFinalize) {
    const result = await prisma.trayecto.updateMany({
      where: { id: trayecto.id, status: "en curso" },
      data: { status: "finalizado" },
    });

    if (result.count > 0) {
      try {
        await notifyTrayectoFinalizado(trayecto);
      } catch (e) {
        console.error("Error enviando emails de trayecto finalizado:", e);
      }
    }
  }
}

async function tickTrayectosAPuntoDeComenzar() {
  const now = new Date();
  const fifteenMinLater = new Date(now.getTime() + 15 * 60 * 1000);

  const trayectos = await prisma.trayecto.findMany({
    where: {
      status: "programado",
      notified_15min: 0,
      hora: { gt: now, lte: fifteenMinLater },
    },
    select: {
      id: true,
      origen: true,
      destino: true,
      hora: true,
      conductor: true,
    },
  });

  for (const trayecto of trayectos) {
    const reservas = await prisma.reserva.findMany({
      where: {
        id_trayecto: trayecto.id,
        status: { not: "canceled" },
      },
      select: { user_id: true },
      distinct: ["user_id"],
    });

    const userIds = new Set([
      trayecto.conductor,
      ...reservas.map((r) => r.user_id),
    ]);
    const emails = [];

    for (const uid of userIds) {
      const email = await getUserEmailById(uid);
      if (email) emails.push(email);
    }

    if (emails.length > 0) {
      const results = await Promise.allSettled(
        emails.map((to) =>
          sendTrayectoAPuntoDeComenzar({
            to,
            trayecto,
          }),
        ),
      );

      for (const r of results) {
        if (r.status === "rejected") {
          console.error(
            "Error enviando email de trayecto a punto de comenzar:",
            r.reason,
          );
        }
      }
    }

    await prisma.trayecto.updateMany({
      where: { id: trayecto.id, notified_15min: 0 },
      data: { notified_15min: 1 },
    });
  }
}

export function startTrayectoSoonReminderCron({
  schedule = "*/5 * * * *",
} = {}) {
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

export function startTrayectoChatCleanupCron({ schedule = "0 3 * * *" } = {}) {
  let running = false;
  const task = cron.schedule(schedule, async () => {
    if (running) return;
    running = true;
    try {
      await tickCleanupFinalizedTrayectoChats();
    } catch (e) {
      console.error("Error en cron de limpieza de chats:", e);
    } finally {
      running = false;
    }
  });

  task.start();
  return task;
}

export function startTrayectoStatusCron({ schedule = "*/1 * * * *" } = {}) {
  let running = false;
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
