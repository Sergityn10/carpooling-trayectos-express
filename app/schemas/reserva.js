import z from "zod";
import {
  RESERVA_STATUS_VALUES,
  RESERVA_STATUS,
  TRIP_OUTCOME_VALUES,
  TRIP_OUTCOME,
} from "../constants/statuses.js";

const reservaSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().min(1),
  trayecto_id: z.string().min(1),
  status: z.enum(RESERVA_STATUS_VALUES).default(RESERVA_STATUS.PENDING),
  stripe_checkout_session_id: z.string().min(1).max(100).optional(),
  stripe_payment_intent_id: z.string().min(1).max(100).optional(),
  stripe_payment_intent_status: z.string().min(1).max(100).optional(),
  trip_outcome: z.enum(TRIP_OUTCOME_VALUES).default(TRIP_OUTCOME.PENDING),
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
