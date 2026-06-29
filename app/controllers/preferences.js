import { database } from "../database.js";
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
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      "SELECT pref_key, value_type, default_value, enum_values, description, is_active FROM preference_definitions WHERE is_active = 1 ORDER BY pref_key",
    );

    const definitions = (rows ?? []).map((r) => ({
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
    const connection = await database.getConnection();
    const [rows] = await connection.query(
      "SELECT d.pref_key, d.value_type, COALESCE(u.value, d.default_value) AS value, d.enum_values, d.description FROM preference_definitions d LEFT JOIN user_preferences u ON u.pref_key = d.pref_key AND u.user_id = ? WHERE d.is_active = 1 ORDER BY d.pref_key",
      [userId],
    );

    const preferences = {};
    for (const r of rows ?? []) {
      preferences[r.pref_key] = parsePreferenceValue(r.value_type, r.value);
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

  const connection = await database.getConnection();

  try {
    let transactionStarted = false;
    const placeholders = keys.map(() => "?").join(",");
    const [defs] = await connection.query(
      `SELECT pref_key, value_type, enum_values FROM preference_definitions WHERE is_active = 1 AND pref_key IN (${placeholders})`,
      keys,
    );

    const defsByKey = new Map((defs ?? []).map((d) => [d.pref_key, d]));
    const missing = keys.filter((k) => !defsByKey.has(k));
    if (missing.length > 0) {
      return res.status(400).send({
        status: "Error",
        message: `Preferencias no válidas o inactivas: ${missing.join(", ")}`,
      });
    }

    await connection.query("START TRANSACTION");
    transactionStarted = true;

    for (const prefKey of keys) {
      const def = defsByKey.get(prefKey);
      const valueType = def.value_type;
      const enumValues = parseEnumValues(def.enum_values);
      const incoming = updates[prefKey];

      if (incoming === null) {
        await connection.query(
          "DELETE FROM user_preferences WHERE user_id = ? AND pref_key = ?",
          [userId, prefKey],
        );
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

      await connection.query(
        "INSERT INTO user_preferences (user_id, pref_key, value, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()",
        [userId, prefKey, storedValue],
      );
    }

    try {
      await connection.query("COMMIT");
    } catch (commitError) {
      const msg = String(commitError?.message ?? "");
      if (!msg.includes("no transaction is active")) {
        throw commitError;
      }
      console.error(
        "Error en updateMyPreferences (during commit):",
        commitError,
      );
    }

    return res.status(200).send({
      status: "Success",
      message: "Se ha actualizado correctamente las preferencias de usuario",
    });
  } catch (error) {
    const msg = String(error?.message ?? "");
    if (msg.includes("no transaction is active")) {
      console.error("Error en updateMyPreferences (during commit):", error);

      return res.status(200).send({
        status: "Success",
        message: "Se ha actualizado correctamente las preferencias de usuario",
      });
    }

    try {
      if (typeof transactionStarted !== "undefined" && transactionStarted) {
        await connection.query("ROLLBACK");
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Error en updateMyPreferences:", error);

    return res.status(400).send({
      status: "Error",
      message: error?.message ?? "Error actualizando preferencias",
    });
  }
}
async function insertDefaultUserPreferences(req, res) {
  const userId = req.user?.userId;
  const userIdParam = req.params.userId;
  if (!userId) {
    return res.status(401).send({ status: "Error", message: "No autenticado" });
  }
  try {
    const connection = await database.getConnection();
    await connection.query("START TRANSACTION");
    // Get all active preference definitions
    const [definitions] = await connection.query(
      "SELECT pref_key, default_value FROM preference_definitions WHERE is_active = 1",
    );
    // Insert default preferences for the user
    for (const def of definitions) {
      await connection.query(
        `INSERT IGNORE INTO user_preferences (user_id, pref_key, value, updated_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, def.pref_key, def.default_value],
      );
    }
    await connection.query("COMMIT");
    return res.status(201).send({
      status: "Success",
      message: "Preferencias por defecto insertadas correctamente",
    });
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error en rollback:", rollbackError);
    }
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
