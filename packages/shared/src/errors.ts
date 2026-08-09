/**
 * Canonical error codes shared by client and server.
 * The server's central error handler maps every failure to one of these;
 * the client narrows on them to decide how to react. Do not invent new
 * codes in either package without adding them here first.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'VEHICLE_UNAVAILABLE',
  'OVERLAPPING_RESERVATION',
  'CUSTOMER_BLOCKED',
  'LICENCE_EXPIRED',
  'AGREEMENT_ALREADY_CLOSED',
  'INSUFFICIENT_PAYMENT',
  'ODOMETER_REGRESSION',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Default HTTP status for each error code, used by the central error handler. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  VEHICLE_UNAVAILABLE: 409,
  OVERLAPPING_RESERVATION: 409,
  CUSTOMER_BLOCKED: 409,
  LICENCE_EXPIRED: 409,
  AGREEMENT_ALREADY_CLOSED: 409,
  INSUFFICIENT_PAYMENT: 409,
  ODOMETER_REGRESSION: 409,
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Human-readable and safe to display to the end user. */
    message: string;
  };
}
