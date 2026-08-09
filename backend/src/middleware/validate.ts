import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validates and narrows req.body against a shared Zod schema, replacing it with
 * the parsed value. The same schema runs on the client, so a field cannot be
 * valid there and rejected here.
 */
export const validateBody =
  <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data as z.infer<S>;
    next();
  };

export const validateQuery =
  <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    // Express 4 query is read-only in types but assignable at runtime.
    Object.defineProperty(req, 'validatedQuery', { value: result.data, configurable: true });
    next();
  };

/** Retrieve the value stashed by validateQuery. */
export function getValidatedQuery<T>(req: import('express').Request): T {
  return (req as unknown as { validatedQuery: T }).validatedQuery;
}
