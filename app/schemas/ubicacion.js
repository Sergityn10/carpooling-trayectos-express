import z from "zod";

const UbicacionSchema = z.object({
    id: z.number().int().positive(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    display_name: z.string().min(2).max(100),
    address: z.string().min(2).max(100),
    city: z.string().min(2).max(100).optional(),
    province: z.string().min(2).max(100).optional(),
    country: z.string().min(2).max(100).optional(),
    postal_code: z.string().min(2).max(100).optional(),
    type: z.string().min(2).max(100).optional(),
    username: z.string().min(2).max(100),
});
const UbicacionSchemaPartial = UbicacionSchema.partial();
const UbicacionSchemaSinId = UbicacionSchema.omit({ id: true });

function validateUbicacionPartial(ubicacion) {
    return UbicacionSchemaPartial.safeParse(ubicacion);
}
function validateUbicacionSinId(ubicacion) {
    return UbicacionSchemaSinId.safeParse(ubicacion);
}
function validateUbicacion(ubicacion) {
    return UbicacionSchema.safeParse(ubicacion);
}

export const UbicacionMethods = {
    validateUbicacion,
    validateUbicacionSinId,
    validateUbicacionPartial
}
