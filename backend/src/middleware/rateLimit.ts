import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import type { LoginRequest } from '@hosni/shared';
import { redis } from '../lib/redis.js';

const RATE_LIMITED_BODY = {
  error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
};

/**
 * Counters live in Redis, not in process memory. In-memory limiting breaks the
 * moment there are two API instances (each keeps its own count) and silently
 * resets on every deploy — so an attacker just waits for a restart. A shared
 * Redis store survives deploys and is consistent across instances. Each limiter
 * gets its own key prefix so their windows never collide.
 */
function store(prefix: string): RedisStore {
  return new RedisStore({
    // rate-limit-redis talks to ioredis via a raw command function.
    sendCommand: (...args: string[]) => redis.call(args[0]!, ...args.slice(1)) as Promise<never>,
    prefix,
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
  store: store('rl:login:ip:'),
});

/** Login limit by account (email): 5 attempts / 15 minutes. */
export const loginAccountLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  store: store('rl:login:acct:'),
  keyGenerator: (req: Request) => {
    const email = (req.body as Partial<LoginRequest> | undefined)?.email;
    return email?.toLowerCase() ?? 'unknown';
  },
});

/** Refresh limit per user, keyed by the refresh cookie. */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  store: store('rl:refresh:'),
  keyGenerator: (req: Request) => {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.refresh_token ?? req.ip ?? 'unknown';
  },
});
