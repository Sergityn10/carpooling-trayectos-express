export const TRAYECTO_STATUS = Object.freeze({
  PROGRAMADO: "programado",
  EN_CURSO: "en curso",
  FINALIZADO: "finalizado",
  CANCELADO: "cancelado",
});

export const TRAYECTO_STATUS_VALUES = Object.freeze([
  TRAYECTO_STATUS.PROGRAMADO,
  TRAYECTO_STATUS.EN_CURSO,
  TRAYECTO_STATUS.FINALIZADO,
  TRAYECTO_STATUS.CANCELADO,
]);

export const TRAYECTO_ACTIVE_STATUSES = Object.freeze([
  TRAYECTO_STATUS.PROGRAMADO,
  TRAYECTO_STATUS.EN_CURSO,
]);

export const TRAYECTO_INACTIVE_STATUSES = Object.freeze([
  TRAYECTO_STATUS.FINALIZADO,
  TRAYECTO_STATUS.CANCELADO,
]);

export const RESERVA_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELED: "canceled",
});

export const RESERVA_STATUS_VALUES = Object.freeze([
  RESERVA_STATUS.PENDING,
  RESERVA_STATUS.COMPLETED,
  RESERVA_STATUS.CANCELED,
]);

export const RESERVA_ACTIVE_STATUSES = Object.freeze([
  RESERVA_STATUS.PENDING,
  RESERVA_STATUS.COMPLETED,
]);

export const TRIP_OUTCOME = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  ISSUE: "issue",
});

export const TRIP_OUTCOME_VALUES = Object.freeze([
  TRIP_OUTCOME.PENDING,
  TRIP_OUTCOME.SUCCESS,
  TRIP_OUTCOME.ISSUE,
]);

export const CAE_STATUS = Object.freeze({
  PENDING: "pending",
  IN_REVIEW: "in_review",
  COMPLETED: "completed",
  CANCELED: "canceled",
});

export const CAE_STATUS_VALUES = Object.freeze([
  CAE_STATUS.PENDING,
  CAE_STATUS.IN_REVIEW,
  CAE_STATUS.COMPLETED,
  CAE_STATUS.CANCELED,
]);

export const CAE_REPORT_STATUS = Object.freeze({
  DRAFT: "draft",
  SENT: "sent",
  REVIEWED: "reviewed",
});

export const CAE_REPORT_STATUS_VALUES = Object.freeze([
  CAE_REPORT_STATUS.DRAFT,
  CAE_REPORT_STATUS.SENT,
  CAE_REPORT_STATUS.REVIEWED,
]);
