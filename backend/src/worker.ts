/**
 * Background worker process. All time-triggered work runs here — never in a
 * request handler or a browser timer. Jobs are idempotent and derive state from
 * the database; payloads carry no customer names or amounts, only a job name,
 * because job data is retained in Redis.
 */
import { Queue, Worker, type JobsOptions } from 'bullmq';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import {
  documentExpiryJob,
  overdueReturnsJob,
  serviceDueJob,
  noShowJob,
  cleanupJob,
  forEachOrg,
} from './services/jobs.service.js';

const QUEUE = 'hosni-jobs';
const connection = redis;

type JobName = 'documentExpiry' | 'overdueReturns' | 'serviceDue' | 'noShow' | 'cleanup';

const handlers: Record<JobName, () => Promise<void>> = {
  documentExpiry: () => forEachOrg((id) => documentExpiryJob(id)),
  overdueReturns: () => forEachOrg((id) => overdueReturnsJob(id)),
  serviceDue: () => forEachOrg((id) => serviceDueJob(id)),
  noShow: () => forEachOrg((id) => noShowJob(id)),
  cleanup: () => forEachOrg((id) => cleanupJob(id)),
};

// "Nightly" is 02:00; overdue hourly; no-show every 15 minutes; cleanup weekly.
// A deterministic repeat jobId means a retry replaces rather than duplicates.
const schedule: Array<{ name: JobName; pattern: string }> = [
  { name: 'documentExpiry', pattern: '0 2 * * *' },
  { name: 'serviceDue', pattern: '30 2 * * *' },
  { name: 'overdueReturns', pattern: '0 * * * *' },
  { name: 'noShow', pattern: '*/15 * * * *' },
  { name: 'cleanup', pattern: '0 3 * * 0' },
];

async function main() {
  await redis.ping();
  const queue = new Queue(QUEUE, { connection });

  for (const { name, pattern } of schedule) {
    const opts: JobsOptions = { repeat: { pattern }, jobId: `repeat:${name}` };
    await queue.add(name, {}, opts);
  }

  const worker = new Worker<Record<string, never>, void, JobName>(
    QUEUE,
    async (job) => {
      const handler = handlers[job.name];
      if (handler) await handler();
    },
    { connection },
  );

  worker.on('failed', (job, err) => logger.error({ job: job?.name, err }, 'Job failed'));
  worker.on('completed', (job) => logger.debug({ job: job.name }, 'Job completed'));

  logger.info('Worker started with scheduled jobs');
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});

process.on('SIGTERM', () => {
  void prisma.$disconnect().then(() => process.exit(0));
});
