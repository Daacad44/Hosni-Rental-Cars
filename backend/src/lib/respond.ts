import type { Response, RequestHandler } from 'express';
import type { ApiSuccess, PaginationMeta } from '@hosni/shared';

export function ok<T>(res: Response, data: T, meta?: PaginationMeta): void {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data };
  res.status(200).json(body);
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json({ data } satisfies ApiSuccess<T>);
}

/** Wrap an async controller so rejected promises reach the error handler. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
