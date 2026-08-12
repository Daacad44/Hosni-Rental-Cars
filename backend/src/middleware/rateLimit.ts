import rateLimit, { type Options, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import type { LoginRequest } from '@hosni/shared';
import { isProd } from '../config/env.js';
import { redis } from '../lib/redis.js';

const RATE_LIMITED_BODY = {
  error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
};

/**
 * In production, counters live in Redis so rate limiting is correct across
 * multiple API instances; in dev/test the default in-memory store is used, so
 * no Redis is required to run or test.
 */
function makeStore(prefix: string): Store | undefined {
  if (!isProd) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => redis.call(args[0]!, ...args.slice(1)) as Promise<never>,
  });
}

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
  store: makeStore('rl:login-ip:'),
});

/** Login limit by account (email): 5 attempts / 15 minutes. */
export const loginAccountLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  store: makeStore('rl:login-acct:'),
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
  store: makeStore('rl:refresh:'),
  keyGenerator: (req: Request) => {
    const cookies = req.cookies as Record<string, string> | undefined;
    return `refresh:${cookies?.refresh_token ?? req.ip ?? 'unknown'}`;
  },
});
