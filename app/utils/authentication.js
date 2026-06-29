import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
dotenv.config();

const PUBLIC_KEY = process.env.PUBLIC_KEY
  ? crypto.createPublicKey(
      process.env.PUBLIC_KEY.replace(/\\n/g, "\n")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n"),
    )
  : null;

function extractToken(req) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const cookieToken = req.cookies?.access_token;
  return bearerToken || cookieToken || null;
}

function verifyToken(token) {
  if (!PUBLIC_KEY) {
    throw new Error("PUBLIC_KEY no configurada en .env");
  }
  return jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] });
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
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error al validar el token:", error.message);
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
    req.user = decoded;
  } catch (error) {
    console.error("Error al validar el token:", error.message);
  }
  next();
}

export const utilsAuthentication = {
  authenticate,
  tryAuthenticate,
};
