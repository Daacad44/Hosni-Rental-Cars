import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a REAL PostgreSQL. The Prisma client is never
 * mocked — mocking the ORM tests the mock, and the bugs that matter (org
 * scoping, the exclusion constraint, derived balances) live in the query the
 * database actually executes.
 *
 * The database is provided by the `postgres-test` service in docker-compose
 * (or the Postgres service in CI). Point the suite at it with TEST_DATABASE_URL;
 * the default matches docker-compose.
 */
const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/hosni_test?schema=public';

export default defineConfig({
  test: {
    include: ['src/**/*.itest.ts'],
    // Env is injected into every worker BEFORE any module (config/env.ts,
    // lib/prisma.ts) is imported, so the shared Prisma singleton connects to
    // the test database rather than the dev one.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'integration-access-secret-key-at-least-32-chars',
      JWT_REFRESH_SECRET: 'integration-refresh-secret-key-at-least-32-chars',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    globalSetup: ['./src/itest/global-setup.ts'],
    setupFiles: ['./src/itest/setup.ts'],
    // One database shared across files, truncated between tests: run serially so
    // no two tests race on the same rows. The concurrency test drives its own
    // parallelism from inside a single test.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
