import z from 'zod'

const comentarioSchema = z.object({
    id_comment: z.number().int().positive(),
    username_commentator: z.string().min(1).max(50),
    username_trayect: z.string().min(1).max(50),
    trayecto_id: z.number().int().positive(),
    opinion: z.string().min(1).max(1024),
    rating: z.number().int().min(1).max(10),
})

const comentarioSchemaPartial = comentarioSchema.partial();
const comentarioSchemaSinId = comentarioSchema.omit({ id_comment: true });
const comentarioUpdateSchema = comentarioSchemaPartial.omit({ username_commentator: true, username_trayect: true, trayecto_id: true });

function validateComentarioUpdate(comentario) {
    return comentarioUpdateSchema.safeParse(comentario);
}
function validateComentario(comentario) {
    return comentarioSchema.safeParse(comentario);
}

function validateComentarioPartial(comentario) {
    return comentarioSchemaPartial.safeParse(comentario);
}

function validateComentarioSinId(comentario) {
    return comentarioSchemaSinId.safeParse(comentario);
}

export const ComentarioSchema = {
    comentarioSchema,
    validateComentario,
    validateComentarioPartial,
    validateComentarioSinId,
    validateComentarioUpdate
}
