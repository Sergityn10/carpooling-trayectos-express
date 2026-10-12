import z from "zod";
const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const viewportQuerySchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(1).max(22).default(12),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plazas: z.coerce.number().int().min(1).max(8).default(1),
  precision: z.enum(["full", "simplified", "bounds"]).default("simplified"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).refine(data => data.minLat <= data.maxLat, {
  message: "minLat no puede ser mayor que maxLat",
  path: ["minLat"],
}).refine(data => data.minLng <= data.maxLng, {
  message: "minLng no puede ser mayor que maxLng",
  path: ["minLng"],
});

const trayectSchema = z.object({
  id: z.string().uuid(),
  origen: z.string().min(2).max(100),
  destino: z.string().min(2).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().min(5).max(5).regex(horaRegex),
  plazas: z.number().min(1).max(7),
  precio: z.number().min(0),
  conductor: z.string().min(1),
  vehiculo_id: z.string().optional().nullable(),
  disponible: z.number().int().min(0).max(7).optional(),
  routeIndex: z.number().int().optional(),
  evento_id: z.string().uuid().optional(),
  destino_lat: z.number().optional(),
  destino_lng: z.number().optional(),
  origen_lat: z.number().optional(),
  origen_lng: z.number().optional(),
});

const trayectoSchemaPartial = trayectSchema.partial();

const trayectSchemaSinId = trayectSchema.omit({ id: true });

function validateTrayectoPartial(trayecto) {
  return trayectoSchemaPartial.safeParse(trayecto);
}
function validateTrayectoSinId(trayecto) {
  return trayectSchemaSinId.safeParse(trayecto);
}

function validateTrayecto(trayecto) {
  return trayectSchema.safeParse(trayecto);
}

export const TrayectosSchema = {
  trayectSchema,
  validateTrayecto,
  validateTrayectoSinId,
  validateTrayectoPartial,
  viewportQuerySchema,
};
