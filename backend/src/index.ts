import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { initMonitoring, flushMonitoring, captureException } from './lib/monitoring.js';

initMonitoring();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on :${env.PORT}`);
});

// Last-resort safety nets so a stray rejection is reported, not swallowed.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureException(reason);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await flushMonitoring();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
