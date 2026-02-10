import z from "zod";

const comentarioSchema = z.object({
  id_comment: z.number().int().positive(),
  user_id_commentator: z.number().int().positive(),
  user_id_trayect: z.number().int().positive(),
  trayecto_id: z.number().int().positive(),
  opinion: z.string().min(1).max(1024),
  rating: z.number().int().min(1).max(10),
});

const comentarioSchemaPartial = comentarioSchema.partial();
const comentarioSchemaSinId = comentarioSchema.omit({ id_comment: true });
const comentarioUpdateSchema = comentarioSchemaPartial.omit({
  user_id_commentator: true,
  user_id_trayect: true,
  trayecto_id: true,
});

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
  validateComentarioUpdate,
};
