import dotenv from "dotenv";
dotenv.config();
const USUARIOS_URL = process.env.USUARIOS_URL;

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  console.log(req.cookies.access_token);
  const cookieToken = req.cookies.access_token;

  const token = bearerToken || cookieToken;
  const tokenSource = bearerToken ? "bearer" : "cookie";
  console.log(tokenSource);

  console.log(token);
  if (!token) {
    return res
      .status(401)
      .send({
        status: "Error",
        message: "No se proporcionó un token de acceso",
      });
  }

  const headers = {};
  if (tokenSource === "bearer") {
    headers.Authorization = `Bearer ${token}`;
  } else {
    // Construir el header 'Cookie'
    const cookieHeaderValue = `access_token=${token}`; // El formato debe ser 'nombre=valor'
    headers.Cookie = cookieHeaderValue;
  }

  fetch(`${USUARIOS_URL}/api/auth/validate`, {
    method: "GET",
    credentials: "include",
    headers,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json();
        throw new Error(`${body.message}`);
      }
      return response.json();
    })
    .then((data) => {
      req.user = data.data;
      next();
    })
    .catch((error) => {
      console.error("Error al validar el token:", error);
      return res
        .status(401)
        .send({
          status: "Error",
          message: "No se proporcionó un token de acceso válido",
        });
    });
}

async function tryAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  const cookieToken = req.cookies.access_token;

  const token = bearerToken || cookieToken;
  const tokenSource = bearerToken ? "bearer" : "cookie";

  if (!token) {
    return next();
  }

  const headers = {};
  if (tokenSource === "bearer") {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const cookieHeaderValue = `access_token=${token}`;
    headers.Cookie = cookieHeaderValue;
  }

  fetch(`${USUARIOS_URL}/api/auth/validate`, {
    method: "GET",
    credentials: "include",
    headers,
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (data?.data) {
        req.user = data.data;
      }
      next();
    })
    .catch((error) => {
      console.error("Error al validar el token:", error);
      next();
    });
}

export const utilsAuthentication = {
  authenticate,
  tryAuthenticate,
};
