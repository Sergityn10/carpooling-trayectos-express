import { EventEmitter } from "node:events";

/**
 * Emisor de eventos internos de dominio para trayectos (Patrón Observer).
 * Desacopla la respuesta HTTP de operaciones secundarias asíncronas.
 */
export const trayectoEmitter = new EventEmitter();

export const TRAYECTO_DOMAIN_EVENTS = Object.freeze({
  NUEVO_TRAYECTO_CREADO: "nuevo_trayecto_creado",
});
