/**
 * Errores de dominio para el módulo de alertas de trayectos.
 */
export class AlertaDomainError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class AlertaValidationError extends AlertaDomainError {
  constructor(message) {
    super(message, 400);
  }
}

export class AlertaForbiddenError extends AlertaDomainError {
  constructor(message = "No tienes autorización para modificar esta alerta") {
    super(message, 403);
  }
}

export class AlertaNotFoundError extends AlertaDomainError {
  constructor(message = "Alerta no encontrada") {
    super(message, 404);
  }
}
