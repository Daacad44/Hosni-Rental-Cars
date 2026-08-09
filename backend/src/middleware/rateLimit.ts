import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import type { LoginRequest } from '@hosni/shared';

const RATE_LIMITED_BODY = {
  error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
};

const shared: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITED_BODY,
};

/** Login limit by IP: 5 attempts / 15 minutes. */
export const loginIpLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
});

/** Login limit by account (email): 5 attempts / 15 minutes. */
export const loginAccountLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => {
    const email = (req.body as Partial<LoginRequest> | undefined)?.email;
    return `login:${email?.toLowerCase() ?? 'unknown'}`;
  },
});

/** Refresh limit per user, keyed by the refresh cookie. */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req: Request) => {
    const cookies = req.cookies as Record<string, string> | undefined;
    return `refresh:${cookies?.refresh_token ?? req.ip ?? 'unknown'}`;
  },
});
