import type { Request, RequestHandler } from 'express';
import type { Role } from '@hosni/shared';
import { verifyAccessToken } from '../utils/tokens.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { unauthorized, forbidden } from '../lib/AppError.js';

export interface AuthContext {
  id: string;
  organizationId: string;
  branchId: string | null;
  role: Role;
}

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

/** Verifies the access-token cookie and attaches req.user. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (!token) return next(unauthorized());
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      organizationId: claims.organizationId,
      branchId: claims.branchId,
      role: claims.role,
    };
    return next();
  } catch {
    return next(unauthorized('Session expired'));
  }
};

/** Guarantees req.user is present; throws otherwise. Use inside controllers. */
export function requireUser(req: Request): AuthContext {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Role gate. Enforced in middleware — hiding a button in React is not security. */
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) return next(forbidden());
    return next();
  };
