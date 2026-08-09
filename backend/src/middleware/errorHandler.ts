import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody, ErrorCode } from '@hosni/shared';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  send(res, 404, 'NOT_FOUND', 'Resource not found');
};

/**
 * The single place an error body is built. Controllers never construct one by
 * hand. Prisma and Zod internals are mapped to safe codes — a stack trace or a
 * Prisma message would leak schema detail to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message);
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed';
    return send(res, 400, 'VALIDATION_ERROR', message);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return send(res, 409, 'CONFLICT', 'A record with these values already exists');
    }
    if (err.code === 'P2025') {
      return send(res, 404, 'NOT_FOUND', 'Resource not found');
    }
  }

  logger.error({ err }, 'Unhandled error');
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};

function send(res: import('express').Response, status: number, code: ErrorCode, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
}
