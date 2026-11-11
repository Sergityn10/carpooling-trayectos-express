import {
  trayectoEmitter,
  TRAYECTO_DOMAIN_EVENTS,
} from "../events/trayectoEmitter.js";
import { AlertasMatcherService } from "../services/alertas/alertasMatcherService.js";

let listenerInitialized = false;

/**
 * Handler asíncrono para procesar alertas cuando se crea un nuevo trayecto.
 * Captura cualquier error internamente para no afectar el flujo principal.
 */
export async function handleNuevoTrayectoCreado(nuevoTrayecto, deps) {
  try {
    return await AlertasMatcherService.processTripAlertMatches(
      nuevoTrayecto,
      deps,
    );
  } catch (error) {
    console.error(
      "[AlertasListener] Error procesando alertas de nuevo trayecto:",
      error?.message ?? error,
    );
    return null;
  }
}

/**
 * Registra la suscripción al evento 'nuevo_trayecto_creado' una sola vez.
 */
export function initAlertasListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;

  trayectoEmitter.on(
    TRAYECTO_DOMAIN_EVENTS.NUEVO_TRAYECTO_CREADO,
    (nuevoTrayecto) => {
      void handleNuevoTrayectoCreado(nuevoTrayecto);
    },
  );
}

initAlertasListener();
