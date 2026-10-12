import rateLimit from "express-rate-limit";

// Rate limiting multinivel según el Plan de Remediación DAST (FASE 3)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 1000, // 1000 peticiones por ventana para uso general
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "Error",
    code: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones desde esta IP. Inténtelo de nuevo más tarde.",
  },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 60, // 60 búsquedas por minuto por IP (protección motor espacial / Google Maps)
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "Error",
    code: "TOO_MANY_REQUESTS",
    message: "Límite de búsquedas excedido. Por favor, espere antes de realizar más búsquedas.",
  },
});

export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 30, // 30 operaciones de creación/modificación/eliminación por minuto
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "Error",
    code: "TOO_MANY_REQUESTS",
    message: "Límite de solicitudes de modificación excedido. Por favor, espere un momento.",
  },
});

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "Error",
    code: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones al panel de administración.",
  },
});
