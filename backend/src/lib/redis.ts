import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Shared Redis connection. BullMQ requires maxRetriesPerRequest = null. */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Without a listener, ioredis 'error' events are thrown and can crash the
// process when Redis is briefly unavailable (or absent in CI). Log and let
// ioredis reconnect on its own.
redis.on('error', (err: Error) => {
  logger.warn({ err: err.message }, 'Redis connection error');
});
