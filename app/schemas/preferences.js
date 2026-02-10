import z from "zod";

const preferenceValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const preferencesUpdateSchema = z.object({
  preferences: z.union([
    z.object({
      // nested format: { preferences: object }
      preferences: z.record(z.string(), preferenceValueSchema),
    }),
    z.record(z.string(), preferenceValueSchema), // old format: object of key-value pairs
    z.array(
      z.object({
        // new format: array of {pref_key, value}
        pref_key: z.string(),
        value: preferenceValueSchema,
      }),
    ),
  ]),
});

const userPreferencesSchema = z.object({
  user_id: z.string(),
  pref_key: z.string(),
  value: z.string(),
  updated_at: z
    .string()
    .optional()
    .default(() => new Date().toISOString()),
});

const userPreferencesCreateSchema = userPreferencesSchema.omit({
  updated_at: true,
});
const userPreferencesUpdateSchema = userPreferencesSchema.partial();

function validateUserPreferences(prefs) {
  return userPreferencesSchema.safeParse(prefs);
}

function validateUserPreferencesCreate(prefs) {
  return userPreferencesCreateSchema.safeParse(prefs);
}

function validateUserPreferencesUpdate(prefs) {
  return userPreferencesUpdateSchema.safeParse(prefs);
}

function validatePreferencesUpdate(payload) {
  return preferencesUpdateSchema.safeParse(payload);
}

export const PreferencesSchema = {
  preferencesUpdateSchema,
  validatePreferencesUpdate,
  userPreferencesSchema,
  validateUserPreferences,
  validateUserPreferencesCreate,
  validateUserPreferencesUpdate,
};
