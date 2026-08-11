import pino from 'pino';
import { env, isProd } from '../config/env.js';
import { currentReqId } from './requestContext.js';

/**
 * Structured logger. Redaction is on by default: never let a password, token,
 * cookie header, or payment reference reach the log stream. The mixin stamps
 * the current request id on every line, so any log emitted while handling a
 * request is correlatable even when it comes from a service that never saw the
 * request object.
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  mixin() {
    const reqId = currentReqId();
    return reqId ? { reqId } : {};
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.reference',
    ],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
