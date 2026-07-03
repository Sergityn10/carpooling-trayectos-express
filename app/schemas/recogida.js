import z from "zod";

const eventoTrayectoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tipo_evento: z.enum(["solicitud", "comienzo", "finalizacion", "recogida"]),
  id_reserva: z.string().uuid().optional(),
});

function validateEventoTrayecto(data) {
  return eventoTrayectoSchema.safeParse(data);
}

export const EventoTrayectoSchema = {
  eventoTrayectoSchema,
  validateEventoTrayecto,
};
