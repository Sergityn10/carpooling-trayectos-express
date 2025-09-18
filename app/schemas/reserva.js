import z from "zod";

const reservaSchema = z.object({
    id: z.number().int().positive(),
    username: z.string().min(1).max(50),
    trayecto_id: z.number().int().positive(),
})

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
    validateReservaPartial
}