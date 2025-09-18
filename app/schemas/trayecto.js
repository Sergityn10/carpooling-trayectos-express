import z from "zod"
const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const trayectSchema = z.object({
    id: z.number().int().positive(),
    origen: z.string().min(2).max(100),
    destino: z.string().min(2).max(100),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora: z.string().min(5).max(5).regex(horaRegex),
    plazas: z.number().min(1).max(7),
    conductor: z.string().min(1).max(50),
    disponible: z.number().int().min(0).max(7).optional()
});

const trayectoSchemaPartial = trayectSchema.partial();


const trayectSchemaSinId = trayectSchema.omit({ id: true });

function validateTrayectoPartial(trayecto){
    return trayectoSchemaPartial.safeParse(trayecto);
}
function validateTrayectoSinId(trayecto) {
    return trayectSchemaSinId.safeParse(trayecto);
}

function validateTrayecto(trayecto){
    return trayectSchema.safeParse(trayecto);
}

export const TrayectosSchema = {
    trayectSchema, 
    validateTrayecto,
    validateTrayectoSinId,
    validateTrayectoPartial
}