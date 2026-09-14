import { prisma } from "../database.js";
import { RESERVA_STATUS, TRAYECTO_STATUS } from "../constants/statuses.js";

async function handleUserDeleted(data) {
  console.log(
    `[EventConsumer] user.deleted - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { user_id } = data;
  if (!user_id) {
    console.log(
      `[EventConsumer] user.deleted - ✗ No se encontró user_id en el payload`,
    );
    return;
  }

  console.log(`[EventConsumer] user.deleted - Procesando usuario ${user_id}`);

  const userStr = String(user_id);

  let reservas;
  try {
    reservas = await prisma.reserva.findMany({
      where: { user_id: userStr, status: RESERVA_STATUS.PENDING },
      select: { id_reserva: true, id_trayecto: true },
    });
    console.log(
      `[EventConsumer] user.deleted - ${reservas.length} reservas pending encontradas`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] user.deleted - ✗ Error al buscar reservas:`,
      error?.message ?? error,
    );
    return;
  }

  for (const reserva of reservas) {
    try {
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
      console.log(
        `[EventConsumer] user.deleted - ✓ Reserva ${reserva.id_reserva} cancelada y plaza liberada`,
      );
    } catch (error) {
      console.error(
        `[EventConsumer] user.deleted - ✗ Error al cancelar reserva ${reserva.id_reserva}:`,
        error?.message ?? error,
      );
    }
  }

  try {
    const trayectosResult = await prisma.trayecto.updateMany({
      where: {
        conductor: userStr,
        status: {
          notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
        },
      },
      data: { status: TRAYECTO_STATUS.CANCELADO },
    });
    console.log(
      `[EventConsumer] user.deleted - ✓ ${trayectosResult.count} trayectos cancelados`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] user.deleted - ✗ Error al cancelar trayectos:`,
      error?.message ?? error,
    );
  }

  console.log(
    `[EventConsumer] user.deleted - Completado: ${reservas.length} reservas canceladas`,
  );
}

async function handleUserUpdated(data) {
  console.log(
    `[EventConsumer] user.updated - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { user_id } = data;
  if (!user_id) {
    console.log(
      `[EventConsumer] user.updated - ✗ No se encontró user_id en el payload`,
    );
    return;
  }
  console.log(
    `[EventConsumer] user.updated - Recibido para usuario ${user_id} (sin acción requerida)`,
  );
}

async function handleCarDeleted(data) {
  console.log(
    `[EventConsumer] car.deleted - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { car_id } = data;
  if (!car_id) {
    console.log(
      `[EventConsumer] car.deleted - ✗ No se encontró car_id en el payload`,
    );
    return;
  }

  console.log(`[EventConsumer] car.deleted - Procesando coche ${car_id}`);

  let trayectos;
  try {
    trayectos = await prisma.trayecto.findMany({
      where: {
        vehiculo_id: car_id,
        status: {
          notIn: [TRAYECTO_STATUS.FINALIZADO, TRAYECTO_STATUS.CANCELADO],
        },
      },
      select: { id: true },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] car.deleted - ✗ Error al buscar trayectos:`,
      error?.message ?? error,
    );
    return;
  }

  if (trayectos.length === 0) {
    console.log(
      `[EventConsumer] car.deleted - Sin trayectos activos con ese coche`,
    );
    return;
  }

  const trayectoIds = trayectos.map((t) => t.id);
  console.log(
    `[EventConsumer] car.deleted - ${trayectos.length} trayectos a cancelar: ${trayectoIds.join(", ")}`,
  );

  try {
    await prisma.trayecto.updateMany({
      where: { id: { in: trayectoIds } },
      data: { status: TRAYECTO_STATUS.CANCELADO },
    });
    console.log(`[EventConsumer] car.deleted - ✓ Trayectos cancelados`);
  } catch (error) {
    console.error(
      `[EventConsumer] car.deleted - ✗ Error al cancelar trayectos:`,
      error?.message ?? error,
    );
  }

  try {
    const reservasResult = await prisma.reserva.updateMany({
      where: {
        id_trayecto: { in: trayectoIds },
        status: RESERVA_STATUS.PENDING,
      },
      data: { status: RESERVA_STATUS.CANCELED },
    });
    console.log(
      `[EventConsumer] car.deleted - ✓ ${reservasResult.count} reservas canceladas`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] car.deleted - ✗ Error al cancelar reservas:`,
      error?.message ?? error,
    );
  }

  for (const tid of trayectoIds) {
    try {
      await prisma.$executeRawUnsafe(
        "UPDATE trayectos SET disponible = plazas WHERE id = ?",
        tid,
      );
    } catch (error) {
      console.error(
        `[EventConsumer] car.deleted - ✗ Error al resetear disponible de trayecto ${tid}:`,
        error?.message ?? error,
      );
    }
  }

  console.log(
    `[EventConsumer] car.deleted - Completado: ${trayectos.length} trayectos cancelados`,
  );
}

async function handlePaymentIntentCreated(data) {
  console.log(
    `[EventConsumer] payment_intent.created - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva, payment_intent_id, mapped_status } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.created - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.created - Procesando reserva ${id_reserva} | payment_intent_id: ${payment_intent_id ?? "(no incluido)"} | mapped_status: ${mapped_status ?? "(no incluido)"}`,
  );

  if (mapped_status !== "completed") {
    console.log(
      `[EventConsumer] payment_intent.created - ⚠ mapped_status no es "completed" (${mapped_status}), no se actualiza la reserva`,
    );
    return;
  }

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.created - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] payment_intent.created - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.created - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status}`,
  );

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] payment_intent.created - ⚠ Reserva ${id_reserva} ya está completed, no se actualiza`,
    );
    return;
  }

  try {
    const updated = await prisma.reserva.update({
      where: { id_reserva: String(id_reserva) },
      data: {
        status: RESERVA_STATUS.COMPLETED,
        ...(payment_intent_id && {
          stripe_payment_intent_id: payment_intent_id,
        }),
      },
    });
    console.log(
      `[EventConsumer] payment_intent.created - ✓ Reserva ${id_reserva} actualizada a completed | stripe_payment_intent_id: ${updated.stripe_payment_intent_id ?? "(no guardado)"}`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.created - ✗ Error al actualizar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
}

async function handlePaymentIntentCaptured(data) {
  console.log(
    `[EventConsumer] payment_intent.captured - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const {
    id_reserva,
    payment_intent_id,
    gross_amount_cents,
    net_amount_cents,
    commission_amount_cents,
    currency,
  } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.captured - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.captured - Procesando reserva ${id_reserva} | payment_intent_id: ${payment_intent_id ?? "(no incluido)"} | bruto: ${gross_amount_cents ?? "?"} | neto: ${net_amount_cents ?? "?"} | comisión: ${commission_amount_cents ?? "?"} ${currency ?? ""}`,
  );

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.captured - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] payment_intent.captured - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.captured - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status}`,
  );

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] payment_intent.captured - ⚠ Reserva ${id_reserva} ya está completed, no se actualiza`,
    );
    return;
  }

  try {
    const updated = await prisma.reserva.update({
      where: { id_reserva: String(id_reserva) },
      data: {
        status: RESERVA_STATUS.COMPLETED,
        ...(payment_intent_id && {
          stripe_payment_intent_id: payment_intent_id,
        }),
      },
    });
    console.log(
      `[EventConsumer] payment_intent.captured - ✓ Reserva ${id_reserva} actualizada a completed | stripe_payment_intent_id: ${updated.stripe_payment_intent_id ?? "(no guardado)"}`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.captured - ✗ Error al actualizar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
}

async function handlePaymentIntentSucceeded(data) {
  console.log(
    `[EventConsumer] payment_intent.succeeded - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva, payment_intent_id } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.succeeded - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.succeeded - Procesando reserva ${id_reserva} | payment_intent_id: ${payment_intent_id ?? "(no incluido)"}`,
  );

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.succeeded - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] payment_intent.succeeded - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.succeeded - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status}`,
  );

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] payment_intent.succeeded - ⚠ Reserva ${id_reserva} ya está completed, no se actualiza`,
    );
    return;
  }

  try {
    const updated = await prisma.reserva.update({
      where: { id_reserva: String(id_reserva) },
      data: {
        status: RESERVA_STATUS.COMPLETED,
        ...(payment_intent_id && {
          stripe_payment_intent_id: payment_intent_id,
        }),
      },
    });
    console.log(
      `[EventConsumer] payment_intent.succeeded - ✓ Reserva ${id_reserva} actualizada a completed | stripe_payment_intent_id: ${updated.stripe_payment_intent_id ?? "(no guardado)"}`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.succeeded - ✗ Error al actualizar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
}

async function handlePaymentIntentFailed(data) {
  console.log(
    `[EventConsumer] payment_intent.failed - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.failed - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.failed - Procesando reserva ${id_reserva}`,
  );

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.failed - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] payment_intent.failed - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.failed - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status} | id_trayecto: ${reserva.id_trayecto}`,
  );

  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] payment_intent.failed - ⚠ Reserva ${id_reserva} ya completada, ignorando fallo`,
    );
    return;
  }

  try {
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
      `[EventConsumer] payment_intent.failed - ✓ Reserva ${id_reserva} cancelada y plaza liberada en trayecto ${reserva.id_trayecto}`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.failed - ✗ Error al cancelar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
}

async function handlePaymentIntentCanceled(data) {
  console.log(
    `[EventConsumer] payment_intent.canceled - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] payment_intent.canceled - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.canceled - Procesando reserva ${id_reserva}`,
  );

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.canceled - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] payment_intent.canceled - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] payment_intent.canceled - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status} | id_trayecto: ${reserva.id_trayecto}`,
  );

  if (reserva.status === RESERVA_STATUS.CANCELED) {
    console.log(
      `[EventConsumer] payment_intent.canceled - ⚠ Reserva ${id_reserva} ya cancelada, no se actualiza`,
    );
    return;
  }
  if (reserva.status === RESERVA_STATUS.COMPLETED) {
    console.log(
      `[EventConsumer] payment_intent.canceled - ⚠ Reserva ${id_reserva} ya completada, no se cancela`,
    );
    return;
  }

  try {
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
      `[EventConsumer] payment_intent.canceled - ✓ Reserva ${id_reserva} cancelada y plaza liberada en trayecto ${reserva.id_trayecto}`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] payment_intent.canceled - ✗ Error al cancelar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
}

async function handleCheckoutSessionExpired(data) {
  console.log(
    `[EventConsumer] checkout_session.expired - Payload completo:`,
    JSON.stringify(data, null, 2),
  );

  const { id_reserva } = data;
  if (!id_reserva) {
    console.log(
      `[EventConsumer] checkout_session.expired - ✗ No se encontró id_reserva en el payload`,
    );
    return;
  }

  console.log(
    `[EventConsumer] checkout_session.expired - Procesando reserva ${id_reserva}`,
  );

  let reserva;
  try {
    reserva = await prisma.reserva.findUnique({
      where: { id_reserva: String(id_reserva) },
    });
  } catch (error) {
    console.error(
      `[EventConsumer] checkout_session.expired - ✗ Error al buscar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    return;
  }

  if (!reserva) {
    console.log(
      `[EventConsumer] checkout_session.expired - ✗ Reserva ${id_reserva} no encontrada en BD`,
    );
    return;
  }

  console.log(
    `[EventConsumer] checkout_session.expired - Reserva ${id_reserva} encontrada | estado actual: ${reserva.status}`,
  );

  if (reserva.status !== RESERVA_STATUS.PENDING) {
    console.log(
      `[EventConsumer] checkout_session.expired - ⚠ Reserva ${id_reserva} no está pending (estado: ${reserva.status}), no se cancela`,
    );
    return;
  }

  try {
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
      `[EventConsumer] checkout_session.expired - ✓ Reserva ${id_reserva} cancelada y plaza liberada`,
    );
  } catch (error) {
    console.error(
      `[EventConsumer] checkout_session.expired - ✗ Error al cancelar reserva ${id_reserva}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
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
  "payment_intent.created": handlePaymentIntentCreated,
  "payment_intent.captured": handlePaymentIntentCaptured,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.failed": handlePaymentIntentFailed,
  "payment_intent.canceled": handlePaymentIntentCanceled,
  "checkout_session.expired": handleCheckoutSessionExpired,
  "platform_event.deleted": handlePlatformEventDeleted,
};

async function handleEvent(routingKey, message) {
  const timestamp = new Date().toISOString();
  console.log(`[EventConsumer] ========== EVENTO RECIBIDO ==========`);
  console.log(`[EventConsumer] Routing key: ${routingKey}`);
  console.log(`[EventConsumer] Timestamp: ${timestamp}`);
  console.log(
    `[EventConsumer] Mensaje completo:`,
    JSON.stringify(message, null, 2),
  );

  const handler = EVENT_HANDLERS[routingKey];

  if (!handler) {
    console.log(`[EventConsumer] ⚠ Sin handler para evento: ${routingKey}`);
    console.log(`[EventConsumer] ================================`);
    return;
  }

  const data = message?.data ?? message;
  console.log(`[EventConsumer] Iniciando handler para: ${routingKey}`);

  try {
    await handler(data);
    console.log(`[EventConsumer] ✓ Handler completado OK para: ${routingKey}`);
  } catch (error) {
    console.error(
      `[EventConsumer] ✗ ERROR en handler ${routingKey}:`,
      error?.message ?? error,
    );
    console.error(`[EventConsumer] Stack:`, error?.stack ?? "(sin stack)");
  }
  console.log(`[EventConsumer] ================================`);
}

const BIND_PATTERNS = [
  "user.deleted",
  "user.updated",
  "car.deleted",
  "payment_intent.created",
  "payment_intent.captured",
  "payment_intent.succeeded",
  "payment_intent.failed",
  "payment_intent.canceled",
  "checkout_session.expired",
  "platform_event.deleted",
];

export const EventConsumer = {
  handleEvent,
  BIND_PATTERNS,
};
