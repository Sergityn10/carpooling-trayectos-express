import { AlertaValidationError } from "../../Errors/AlertaErrors.js";

export const TIPO_ALERTA = Object.freeze({
  EVENTO: "EVENTO",
  DESTINO: "DESTINO",
});

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AlertaValidationError(
      `El campo '${fieldName}' es obligatorio y debe ser una cadena no vacía`,
    );
  }
  return value.trim();
}

const ALERTA_BUILDERS = {
  [TIPO_ALERTA.EVENTO]: ({ eventoId }) => ({
    tipo: TIPO_ALERTA.EVENTO,
    eventoId: requireNonEmptyString(eventoId, "eventoId"),
    destino: null,
  }),
  [TIPO_ALERTA.DESTINO]: ({ destino }) => ({
    tipo: TIPO_ALERTA.DESTINO,
    eventoId: null,
    destino: requireNonEmptyString(destino, "destino"),
  }),
};

/**
 * Patrón Factory para validar y construir payloads STI de AlertaTrayecto.
 */
export class AlertaFactory {
  /**
   * Valida los datos de entrada según el tipo de alerta y devuelve
   * la estructura normalizada para persistencia STI.
   */
  static createPayload(input) {
    if (!input || typeof input !== "object") {
      throw new AlertaValidationError("El cuerpo de la petición es inválido");
    }

    const { tipo } = input;
    const builder = typeof tipo === "string" ? ALERTA_BUILDERS[tipo] : null;

    if (!builder) {
      throw new AlertaValidationError(
        `Tipo de alerta inválido. Valores permitidos: ${Object.values(TIPO_ALERTA).join(", ")}`,
      );
    }

    return builder(input);
  }
}
