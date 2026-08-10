import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma.js';

/**
 * Per-test isolation: every table is truncated before each test so no test can
 * see, or be perturbed by, another's rows. TRUNCATE ... CASCADE respects the
 * foreign-key graph and RESTART IDENTITY resets sequences. The migrations table
 * is left alone — the schema is applied once in global setup.
 */
async function truncateAll(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});
