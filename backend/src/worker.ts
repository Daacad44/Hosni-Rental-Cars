/**
 * Background worker process. Time-triggered work (document expiry, overdue
 * returns, service-due, no-show, cleanup) lives here — never in a request
 * handler or a browser timer. Jobs are registered as later modules land.
 */
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';

async function main() {
  await redis.ping();
  logger.info('Worker started (no jobs registered yet)');
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
