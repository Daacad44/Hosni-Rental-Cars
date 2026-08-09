import pino from 'pino';
import { env, isProd } from '../config/env.js';

/**
 * Structured logger. Redaction is on by default: never let a password, token,
 * cookie header, or payment reference reach the log stream.
 */
export const logger = pino({
  level: isProd ? 'info' : 'debug',
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
