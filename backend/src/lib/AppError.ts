import { ERROR_STATUS, type ErrorCode } from '@hosni/shared';

/**
 * The only error type controllers and services should throw for expected
 * failures. The central error handler turns it into the API error envelope.
 * Messages here are safe to display; never put schema or stack detail in them.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}

export const notFound = (message = 'Not found') => new AppError('NOT_FOUND', message);
export const unauthorized = (message = 'Not authenticated') =>
  new AppError('UNAUTHORIZED', message);
export const forbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', message);
export const conflict = (message = 'Conflict') => new AppError('CONFLICT', message);
