import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
dotenv.config();

function getPublicKey() {
  if (!process.env.PUBLIC_KEY) {
    return null;
  }
  try {
    const formatted = process.env.PUBLIC_KEY.replace(/\\n/g, "\n")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("\n");
    return crypto.createPublicKey(formatted);
  } catch (error) {
    console.error("[Auth] Error al procesar PUBLIC_KEY:", error.message);
    return null;
  }
}

const PUBLIC_KEY = getPublicKey();

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.authentication;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const cookieToken = req.cookies?.access_token;
  return bearerToken || cookieToken || null;
}

function verifyToken(token) {
  if (!PUBLIC_KEY) {
    throw new Error("PUBLIC_KEY no configurada o inválida en el servidor");
  }

  // Lista blanca estricta de algoritmos (rechaza 'none', 'HS256', etc.)
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ["RS256"],
  });
}

function normalizeUserContext(decoded) {
  if (!decoded || typeof decoded !== "object") return null;
  const userId = String(decoded.userId || decoded.id || "");
  if (!userId) return null;

  return {
    ...decoded,
    id: userId,
    userId: userId,
    role: decoded.role || "user",
    email: decoded.email || null,
  };
}

async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).send({
      status: "Error",
      message: "No se proporcionó un token de acceso",
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = normalizeUserContext(decoded);

    if (!user) {
      return res.status(401).send({
        status: "Error",
        message: "Token inválido: identificador de usuario no encontrado",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).send({
      status: "Error",
      message: "No se proporcionó un token de acceso válido",
    });
  }
}

async function tryAuthenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    const user = normalizeUserContext(decoded);
    if (user) {
      req.user = user;
    }
  } catch (_error) {
    // tryAuthenticate no falla la petición si el token no es válido
  }
  next();
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).send({
        status: "Error",
        message: "No tienes los privilegios necesarios para realizar esta acción",
      });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole(["admin"])(req, res, next);
}

function requireOwnership(getOwnerId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).send({
        status: "Error",
        message: "No autenticado",
      });
    }

    if (req.user.role === "admin") {
      return next();
    }

    const targetOwnerId = String(getOwnerId(req) || "");
    const currentUserId = String(req.user.id || req.user.userId || "");

    if (!targetOwnerId || targetOwnerId !== currentUserId) {
      return res.status(403).send({
        status: "Error",
        message: "No tienes autorización para acceder o modificar este recurso",
      });
    }

    next();
  };
}

export const utilsAuthentication = {
  authenticate,
  tryAuthenticate,
  requireRole,
  requireAdmin,
  requireOwnership,
  extractToken,
  verifyToken,
  normalizeUserContext,
};
