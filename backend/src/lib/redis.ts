import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/** Shared Redis connection. BullMQ requires maxRetriesPerRequest = null. */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
