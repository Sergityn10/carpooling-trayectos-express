import z from "zod";

const reservaSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  trayecto_id: z.number().int().positive(),
  status: z.enum(["pending", "completed", "canceled"]).default("pending"),
  stripe_checkout_session_id: z.string().min(1).max(100).optional(),
  stripe_payment_intent_id: z.string().min(1).max(100).optional(),
  stripe_payment_intent_status: z.string().min(1).max(100).optional(),
  trip_outcome: z.enum(["pending", "success", "issue"]).default("pending"),
  trip_outcome_reason: z.string().max(500).optional(),
  trip_outcome_at: z.string().max(100).optional(),
});

const reservaSchemaPartial = reservaSchema.partial();
const reservaSchemaSinId = reservaSchema.omit({ id: true });

function validateReservaPartial(reserva) {
  return reservaSchemaPartial.safeParse(reserva);
}

function validateReservaSinId(reserva) {
  return reservaSchemaSinId.safeParse(reserva);
}

function validateReserva(reserva) {
  return reservaSchema.safeParse(reserva);
}

export const ReservaSchema = {
  reservaSchema,
  validateReserva,
  validateReservaSinId,
  validateReservaPartial,
};
