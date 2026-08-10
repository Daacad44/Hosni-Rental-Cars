import { execSync } from 'node:child_process';

/**
 * Runs once before the whole integration suite. Applies every migration to the
 * test database with `prisma migrate deploy` — the same migrations production
 * runs, including the btree_gist exclusion constraint the concurrency test
 * relies on. Idempotent: already-applied migrations are skipped.
 */
export default function setup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/hosni_test?schema=public';

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
