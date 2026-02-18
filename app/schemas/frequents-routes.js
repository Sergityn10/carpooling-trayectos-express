import z from "zod";

const frequentRouteSchema = z.object({
  id: z.number().int().positive(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),

  user_id: z.string().min(1),
  name: z.string().min(1).max(50).optional(),

  originAddress: z.string().min(1).max(255),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),

  destAddress: z.string().min(1).max(255),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),

  role: z.enum(["PASSENGER", "DRIVER"]).default("DRIVER"),
  seats: z.number().int().min(1).max(7).default(1),
});

const frequentRouteSchemaPartial = frequentRouteSchema.partial();

const frequentRouteSchemaCreate = frequentRouteSchema.omit({
  id: true,
  user_id: true,
  createdAt: true,
  updatedAt: true,
});

function validateFrequentRoute(payload) {
  return frequentRouteSchema.safeParse(payload);
}

function validateFrequentRouteCreate(payload) {
  return frequentRouteSchemaCreate.safeParse(payload);
}

function validateFrequentRoutePartial(payload) {
  return frequentRouteSchemaPartial.safeParse(payload);
}

export const FrequentRoutesSchema = {
  frequentRouteSchema,
  validateFrequentRoute,
  validateFrequentRouteCreate,
  validateFrequentRoutePartial,
};
