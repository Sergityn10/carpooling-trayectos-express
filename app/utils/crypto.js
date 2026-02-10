import crypto from "crypto";

// IMPORTANTE: Esta clave debe estar en tu archivo .env
// Debe tener exactamente 32 caracteres para AES-256
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";
const IV_LENGTH = 16; // Para AES, esto siempre es 16

function getEncryptionKeyBuffer() {
  const raw = String(ENCRYPTION_KEY ?? "");

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const keyBuf = Buffer.from(raw);
  if (keyBuf.length === 32) {
    return keyBuf;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

const USER_SENSITIVE_FIELDS = [
  "dni",
  "name",
  // "surname",
  "phone",
  "direccion",
  "provincia",
  "codigo_postal",
  "fecha_nacimiento",
];

/**
 * Función para Desencriptar
 * @param {string} text - El texto en formato "IV:HexEncriptado" guardado en la BD
 */
function decrypt(text) {
  try {
    // 1. Separamos el IV del contenido cifrado
    let textParts = text.split(":");

    // 2. Convertimos el IV (hex) a Buffer
    let iv = Buffer.from(textParts.shift(), "hex");

    // 3. El resto es el texto cifrado (hex)
    let encryptedText = Buffer.from(textParts.join(":"), "hex");

    // 4. Creamos el objeto descifrador
    // Debe usar el MISMO algoritmo y la MISMA clave que al encriptar
    let decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      getEncryptionKeyBuffer(),
      iv,
    );

    // 5. Desciframos
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // 6. Retornamos el texto original
    return decrypted.toString();
  } catch (error) {
    // Si la clave es incorrecta o el texto está corrupto, fallará aquí
    console.error("Error al desencriptar:", error);
    return null;
  }
}

function looksEncrypted(text) {
  if (typeof text !== "string") return false;
  const parts = text.split(":");
  if (parts.length < 2) return false;
  const ivHex = parts[0];
  const dataHex = parts.slice(1).join(":");
  if (ivHex.length !== IV_LENGTH * 2) return false;
  if (!/^[0-9a-fA-F]+$/.test(ivHex)) return false;
  if (!dataHex || !/^[0-9a-fA-F]+$/.test(dataHex)) return false;
  return true;
}

function decryptMaybe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  if (!looksEncrypted(value)) return value;
  const decrypted = decrypt(value);
  return decrypted === null ? value : decrypted;
}

function encryptMaybe(value) {
  if (value === null || value === undefined) return value;
  const text = typeof value === "string" ? value : String(value);
  if (looksEncrypted(text)) return text;
  return encrypt(text);
}

function encryptFields(obj, fields) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const field of fields ?? []) {
    if (Object.prototype.hasOwnProperty.call(out, field)) {
      out[field] = encryptMaybe(out[field]);
    }
  }
  return out;
}

function decryptFields(obj, fields) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const field of fields ?? []) {
    if (Object.prototype.hasOwnProperty.call(out, field)) {
      out[field] = decryptMaybe(out[field]);
    }
  }
  return out;
}

// Incluyo la función de encriptar para que tengas el par completo
function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    getEncryptionKeyBuffer(),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export const methods = {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  USER_SENSITIVE_FIELDS,
};
