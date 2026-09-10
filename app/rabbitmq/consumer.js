import { prisma } from "../database.js";
import { RESERVA_STATUS, TRAYECTO_STATUS } from "../constants/statuses.js";

async function handleUserDeleted(data) {
  const { user_id } = data;
  if (!user_id) return;

  console.log(
    `[EventConsumer] Procesando user.deleted para usuario ${user_id}`,
  );

  const userStr = String(user_id);

  const reservas = await prisma.reserva.findMany({
    where: { user_id: userStr, status: RESERVA_STATUS.PENDING },
    select: { id_reserva: true, id_trayecto: true },
  });

  for (const reserva of reservas) {
    await prisma.$transaction([
      prisma.reserva.update({
        where: { id_reserva: reserva.id_reserva },
        data: { status: RESERVA_STATUS.CANCELED },
      }),
      prisma.$executeRawUnsafe(
        "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
        reserva.id_trayecto,
      ),
    ]);
  }

  await prisma.trayecto.updateMany({
    where: {
      conductor: userStr,
      status: {
        notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
      },
    },
    data: { status: TRAYECTO_STATUS.CANCELADO },
  });

  console.log(
    `[EventConsumer] user.deleted procesado: ${reservas.length} reservas canceladas, trayectos cancelados`,
  );
}

async function handleUserUpdated(data) {
  const { user_id } = data;
  if (!user_id) return;
  console.log(
    `[EventConsumer] user.updated recibido para usuario ${user_id} (sin acción requerida)`,
  );
}

async function handleCarDeleted(data) {
  const { car_id, user_id } = data;
  if (!car_id || !user_id) return;

  console.log(
    `[EventConsumer] Procesando car.deleted: coche ${car_id} del usuario ${user_id}`,
  );

  const trayectos = await prisma.trayecto.findMany({
    where: {
      vehiculo_id: car_id,
      conductor: String(user_id),
      status: {
        notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
      },
    },
    select: { id: true },
  });

  if (trayectos.length === 0) {
    console.log(
      "[EventConsumer] car.deleted: sin trayectos activos con ese coche",
    );
    return;
  }

  const trayectoIds = trayectos.map((t) => t.id);

  await prisma.trayecto.updateMany({
    where: { id: { in: trayectoIds } },
    data: { status: TRAYECTO_STATUS.CANCELADO },
  });

  await prisma.reserva.updateMany({
    where: {
      id_trayecto: { in: trayectoIds },
      status: RESERVA_STATUS.PENDING,
    },
    data: { status: RESERVA_STATUS.CANCELED },
  });

  for (const tid of trayectoIds) {
    await prisma.$executeRawUnsafe(
      "UPDATE trayectos SET disponible = plazas WHERE id = ?",
      tid,
    );
  }

  console.log(
    `[EventConsumer] car.deleted procesado: ${trayectos.length} trayectos cancelados`,
  );
}

async function handlePaymentIntentSucceeded(data) {
  console.log(
    `[EventConsumer] payment_intent.succeeded - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva, payment_intent_id } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.succeeded - No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] Procesando payment_intent.succeeded para reserva ${id_reserva}`,
  );

  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: String(id_reserva) },
  });

  if (!reserva) {
    console.log(`[EventConsumer] Reserva ${id_reserva} no encontrada`);
    return;
  }

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(`[EventConsumer] Reserva ${id_reserva} ya completada`);
    return;
  }

  await prisma.reserva.update({
    where: { id_reserva: String(id_reserva) },
    data: {
      status: RESERVA_STATUS.COMPLETED,
      ...(payment_intent_id && {
        stripe_payment_intent_id: payment_intent_id,
      }),
    },
  });

  console.log(`[EventConsumer] Reserva ${id_reserva} marcada como completed`);
}

async function handlePaymentIntentFailed(data) {
  console.log(
    `[EventConsumer] payment_intent.failed - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.failed - No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] Procesando payment_intent.failed para reserva ${id_reserva}`,
  );

  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: String(id_reserva) },
  });

  if (!reserva) return;

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] Reserva ${id_reserva} ya completada, ignorando fallo`,
    );
    return;
  }

  await prisma.$transaction([
    prisma.reserva.update({
      where: { id_reserva: String(id_reserva) },
      data: { status: RESERVA_STATUS.CANCELED },
    }),
    prisma.$executeRawUnsafe(
      "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
      reserva.id_trayecto,
    ),
  ]);

  console.log(
    `[EventConsumer] Reserva ${id_reserva} cancelada por fallo de pago`,
  );
}

async function handlePaymentIntentCanceled(data) {
  console.log(
    `[EventConsumer] payment_intent.canceled - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.canceled - No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] Procesando payment_intent.canceled para reserva ${id_reserva}`,
  );

  const reserva = await prisma.reserva.findUnique({
    where: { id_reserva: String(id_reserva) },
  });

  if (!reserva) return;
  if (reserva.status === RESERVA_STATUS.CANCELED) return;
  if (reserva.status === RESERVA_STATUS.COMPLETED) return;

  await prisma.$transaction([
    prisma.reserva.update({
      where: { id_reserva: String(id_reserva) },
      data: { status: RESERVA_STATUS.CANCELED },
    }),
    prisma.$executeRawUnsafe(
      "UPDATE trayectos SET disponible = CASE WHEN disponible < plazas THEN disponible + 1 ELSE disponible END WHERE id = ?",
      reserva.id_trayecto,
    ),
  ]);

  console.log(`[EventConsumer] Reserva ${id_reserva} cancelada`);
}

async function handlePlatformEventDeleted(data) {
  const { event_id } = data;
  if (!event_id) return;

  console.log(`[EventConsumer] Procesando platform_event.deleted: ${event_id}`);

  const trayectos = await prisma.trayecto.findMany({
    where: {
      evento_id: String(event_id),
      status: {
        notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
      },
    },
    select: { id: true },
  });

  if (trayectos.length === 0) {
    console.log(
      "[EventConsumer] platform_event.deleted: sin trayectos activos",
    );
    return;
  }

  const trayectoIds = trayectos.map((t) => t.id);

  await prisma.trayecto.updateMany({
    where: { id: { in: trayectoIds } },
    data: { status: TRAYECTO_STATUS.CANCELADO },
  });

  await prisma.reserva.updateMany({
    where: {
      id_trayecto: { in: trayectoIds },
      status: RESERVA_STATUS.PENDING,
    },
    data: { status: RESERVA_STATUS.CANCELED },
  });

  for (const tid of trayectoIds) {
    await prisma.$executeRawUnsafe(
      "UPDATE trayectos SET disponible = plazas WHERE id = ?",
      tid,
    );
  }

  console.log(
    `[EventConsumer] platform_event.deleted procesado: ${trayectos.length} trayectos cancelados`,
  );
}

const EVENT_HANDLERS = {
  "user.deleted": handleUserDeleted,
  "user.updated": handleUserUpdated,
  "car.deleted": handleCarDeleted,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.failed": handlePaymentIntentFailed,
  "payment_intent.canceled": handlePaymentIntentCanceled,
  "platform_event.deleted": handlePlatformEventDeleted,
};

async function handleEvent(routingKey, message) {
  const handler = EVENT_HANDLERS[routingKey];

  if (!handler) {
    console.log(`[EventConsumer] Sin handler para evento: ${routingKey}`);
    return;
  }

  const data = message?.data ?? message;
  await handler(data);
}

const BIND_PATTERNS = [
  "user.deleted",
  "user.updated",
  "car.deleted",
  "payment_intent.succeeded",
  "payment_intent.failed",
  "payment_intent.canceled",
  "platform_event.deleted",
];

export const EventConsumer = {
  handleEvent,
  BIND_PATTERNS,
};
