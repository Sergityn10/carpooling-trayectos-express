import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";

let privateKey = null;

/**
 * Carga la clave privada para firmar tokens JWT de test
 * En tests, usa una clave estática simple si no existe la real
 */
function getPrivateKey() {
  if (privateKey) return privateKey;

  try {
    // Intentar leer la clave real del proyecto
    privateKey = readFileSync(join(process.cwd(), "keys", "private.pem"), "utf8");
  } catch (e) {
    // Clave de test por defecto (RS256)
    privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDd7xQqJZKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
tKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9GtKzJh9G
-----END PRIVATE KEY-----`;
  }
  return privateKey;
}

/**
 * Genera un token JWT válido para tests
 */
export function generateTestToken(userId, overrides = {}) {
  const payload = {
    sub: userId,
    id: userId,
    email: overrides.email || `test-${userId}@example.com`,
    name: overrides.name || "Usuario Test",
    roles: overrides.roles || ["user"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    ...overrides,
  };

  return jwt.sign(payload, getPrivateKey(), { algorithm: "RS256" });
}

/**
 * Crea headers de autorización para tests
 */
export function createAuthHeaders(userId, overrides = {}) {
  const token = generateTestToken(userId, overrides);
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `access_token=${token}`,
  };
}

/**
 * Middleware de test para simular autenticación en Express
 * Se usa en tests de integración para inyectar req.user
 */
export function mockAuthMiddleware(userId, overrides = {}) {
  return (req, res, next) => {
    req.user = {
      id: userId,
      email: `test-${userId}@example.com`,
      name: "Usuario Test",
      roles: ["user"],
      ...overrides,
    };
    next();
  };
}

/**
 * Genera token de conductor específico
 */
export function generateDriverToken(driverId = "test-driver-1") {
  return generateTestToken(driverId, {
    roles: ["user", "driver"],
    name: "Conductor Test",
  });
}

/**
 * Genera token de pasajero específico
 */
export function generatePassengerToken(passengerId = "test-passenger-1") {
  return generateTestToken(passengerId, {
    roles: ["user"],
    name: "Pasajero Test",
  });
}

/**
 * Genera token de administrador
 */
export function generateAdminToken(adminId = "test-admin-1") {
  return generateTestToken(adminId, {
    roles: ["user", "admin"],
    name: "Admin Test",
  });
}