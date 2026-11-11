/**
 * Constantes oficiales de eventos de dominio y notificaciones compartidas
 * entre ms-trayectos y carpooling-notifications.
 */

export const EXCHANGE = "carpooling_events";
export const EXCHANGE_TYPE = "topic";
export const EXCHANGE_DURABLE = true;

export const EXCHANGE_OPTIONS = Object.freeze({
  type: EXCHANGE_TYPE,
  durable: EXCHANGE_DURABLE,
});

export const EVENT_SOURCE = "carpooling-trips";

export const PUBLISH_OPTIONS = Object.freeze({
  persistent: true,
  contentType: "application/json",
});

export const CHANNELS = Object.freeze(["push", "email"]);

export const MAX_BATCH_RECIPIENTS = 5000;

export const TRIP_ALERT_MATCHED = "trip.alert.matched";
export const TRIP_CONFIRMED = "trip.confirmed";
export const TRIP_BOOKED = "trip.booked";
export const TRIP_CANCELLED = "trip.cancelled";
export const TRIP_STARTED = "trip.started";
export const TRIP_COMPLETED = "trip.completed";
export const TRIP_BOOKING_REQUESTED = "trip.booking.requested";

export const TRIP_EVENTS = Object.freeze({
  TRIP_ALERT_MATCHED,
  TRIP_CONFIRMED,
  TRIP_BOOKED,
  TRIP_CANCELLED,
  TRIP_STARTED,
  TRIP_COMPLETED,
  TRIP_BOOKING_REQUESTED,
});

export const NOTIFICATION_TYPES = Object.freeze({
  TRIP_ALERT_MATCHED: "trip_alert_matched",
  TRIP_CONFIRMATION: "trip_confirmation",
  TRIP_BOOKED: "trip_booked",
  TRIP_CANCELLED: "trip_cancelled",
  TRIP_STARTED: "trip_started",
  TRIP_COMPLETED: "trip_completed",
  BOOKING_REQUEST: "booking_request",
});
