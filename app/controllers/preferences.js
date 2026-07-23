import { prisma } from "../database.js";
import { PreferencesSchema } from "../schemas/preferences.js";

function parseEnumValues(enumValues) {
  if (!enumValues) return null;
  if (Array.isArray(enumValues)) return enumValues;
  if (typeof enumValues !== "string") return null;
  const trimmed = enumValues.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringifyPreferenceValue(valueType, value) {
  switch (valueType) {
    case "boolean": {
      if (typeof value === "boolean") return value ? "1" : "0";
      if (typeof value === "number" && (value === 0 || value === 1)) {
        return value === 1 ? "1" : "0";
      }
      if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (v === "1" || v === "true") return "1";
        if (v === "0" || v === "false") return "0";
      }
      throw new Error("Valor inválido: se esperaba boolean");
    }
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) {
        throw new Error("Valor inválido: se esperaba number");
      }
      return String(num);
    }
    case "text": {
      if (typeof value !== "string") {
        throw new Error("Valor inválido: se esperaba text");
      }
      return value;
    }
    case "enum": {
      if (typeof value !== "string") {
        throw new Error("Valor inválido: se esperaba enum (string)");
      }
      return value;
    }
    default:
      throw new Error("Tipo de preferencia inválido");
  }
}

function parsePreferenceValue(valueType, raw) {
  const value = raw == null ? "" : String(raw);
  switch (valueType) {
    case "boolean":
      return value === "1" || value.toLowerCase() === "true";
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case "text":
    case "enum":
      return value;
    default:
      return value;
  }
}

async function getDefinitions(req, res) {
  try {
    const rows = await prisma.preferenceDefinition.findMany({
      where: { is_active: 1 },
      orderBy: { pref_key: "asc" },
    });

    const definitions = rows.map((r) => ({
      pref_key: r.pref_key,
      value_type: r.value_type,
      default_value: parsePreferenceValue(r.value_type, r.default_value),
      enum_values: parseEnumValues(r.enum_values),
      description: r.description ?? null,
      is_active: Boolean(r.is_active),
    }));

    return res.status(200).send({ status: "Success", definitions });
  } catch (error) {
    console.error("Error en getDefinitions:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error obteniendo catálogo de preferencias",
    });
  }
}

async function getMyPreferences(req, res) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }

  try {
    const defs = await prisma.preferenceDefinition.findMany({
      where: { is_active: 1 },
      orderBy: { pref_key: "asc" },
    });
    const userPrefs = await prisma.userPreference.findMany({
      where: { user_id: userId },
    });
    const userPrefsMap = new Map(userPrefs.map((p) => [p.pref_key, p.value]));

    const preferences = {};
    for (const d of defs) {
      const rawValue = userPrefsMap.has(d.pref_key)
        ? userPrefsMap.get(d.pref_key)
        : d.default_value;
      preferences[d.pref_key] = parsePreferenceValue(d.value_type, rawValue);
    }

    return res.status(200).send({ status: "Success", userId, preferences });
  } catch (error) {
    console.error("Error en getMyPreferences:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Error obteniendo preferencias" });
  }
}

async function getUserPreferences(req, res) {
  const { userId } = req.user || {};
  const { userIdParam } = req.params;

  if (!userIdParam) {
    return res
      .status(400)
      .send({ status: "Error", message: "userIdParam requerido" });
  }

  if (userIdParam && userId && userId !== userIdParam) {
    return res.status(401).send({
      status: "Error",
      message: "No tienes permiso para ver las preferencias de este usuario",
    });
  }

  req.user = { ...(req.user || {}), userId: userIdParam };
  return getMyPreferences(req, res);
}

async function updateMyPreferences(req, res) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }
  const validation = PreferencesSchema.validatePreferencesUpdate(req.body);
  if (!validation.success) {
    return res
      .status(400)
      .send({ status: "Error", message: JSON.parse(validation.error.message) });
  }

  let prefsInput = validation.data.preferences;
  // If the input is an object that has a property 'preferences', use that property
  if (
    typeof prefsInput === "object" &&
    prefsInput !== null &&
    "preferences" in prefsInput
  ) {
    prefsInput = prefsInput.preferences;
  }

  let preferencesArray;
  if (Array.isArray(prefsInput)) {
    preferencesArray = prefsInput;
  } else if (typeof prefsInput === "object" && prefsInput !== null) {
    preferencesArray = Object.entries(prefsInput).map(([pref_key, value]) => ({
      pref_key,
      value,
    }));
  } else {
    preferencesArray = [];
  }

  if (preferencesArray.length === 0) {
    return res.status(400).send({
      status: "Error",
      message: "No se proporcionaron preferencias para actualizar",
    });
  }

  const updates = {};
  for (const item of preferencesArray) {
    updates[item.pref_key] = item.value;
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return res.status(400).send({
      status: "Error",
      message: "No se proporcionaron preferencias para actualizar",
    });
  }

  try {
    const defs = await prisma.preferenceDefinition.findMany({
      where: { is_active: 1, pref_key: { in: keys } },
    });

    const defsByKey = new Map(defs.map((d) => [d.pref_key, d]));
    const missing = keys.filter((k) => !defsByKey.has(k));
    if (missing.length > 0) {
      return res.status(400).send({
        status: "Error",
        message: `Preferencias no válidas o inactivas: ${missing.join(", ")}`,
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const prefKey of keys) {
        const def = defsByKey.get(prefKey);
        const valueType = def.value_type;
        const enumValues = parseEnumValues(def.enum_values);
        const incoming = updates[prefKey];

        if (incoming === null) {
          await tx.userPreference.deleteMany({
            where: { user_id: userId, pref_key: prefKey },
          });
          continue;
        }

        const storedValue = stringifyPreferenceValue(valueType, incoming);
        if (
          valueType === "enum" &&
          enumValues &&
          !enumValues.includes(storedValue)
        ) {
          throw new Error(
            `Valor inválido para ${prefKey}. Valores permitidos: ${enumValues.join(", ")}`,
          );
        }

        await tx.userPreference.upsert({
          where: {
            user_id_pref_key: { user_id: userId, pref_key: prefKey },
          },
          update: { value: storedValue, updated_at: new Date() },
          create: {
            user_id: userId,
            pref_key: prefKey,
            value: storedValue,
            updated_at: new Date(),
          },
        });
      }
    });

    return res.status(200).send({
      status: "Success",
      message: "Se ha actualizado correctamente las preferencias de usuario",
    });
  } catch (error) {
    console.error("Error en updateMyPreferences:", error);

    return res.status(400).send({
      status: "Error",
      message: error?.message ?? "Error actualizando preferencias",
    });
  }
}
async function insertDefaultUserPreferences(req, res) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }
  try {
    const definitions = await prisma.preferenceDefinition.findMany({
      where: { is_active: 1 },
    });

    await prisma.$transaction(async (tx) => {
      for (const def of definitions) {
        await tx.userPreference.upsert({
          where: {
            user_id_pref_key: { user_id: userId, pref_key: def.pref_key },
          },
          update: {},
          create: {
            user_id: userId,
            pref_key: def.pref_key,
            value: def.default_value,
            updated_at: new Date(),
          },
        });
      }
    });

    return res.status(201).send({
      status: "Success",
      message: "Preferencias por defecto insertadas correctamente",
    });
  } catch (error) {
    console.error("Error en insertDefaultUserPreferences:", error);
    return res.status(500).send({
      status: "Error",
      message: "Error insertando preferencias por defecto",
    });
  }
}
export const PreferencesController = {
  getDefinitions,
  getMyPreferences,
  getUserPreferences,
  updateMyPreferences,
  insertDefaultUserPreferences,
};
