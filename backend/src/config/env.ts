import { z } from 'zod';

// Load a local .env in development using Node's built-in loader (no dependency).
// In production, secrets are real environment variables and no file is needed.
if (process.env.NODE_ENV !== 'production') {
  const loader = (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  try {
    loader?.('.env');
  } catch {
    // No .env file present; rely on the ambient environment.
  }
}

/**
 * Runtime secrets, validated at boot. A process that dies at startup naming
 * the missing variable is far cheaper than one that dies on a null at 3am.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),

  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  // Grace window so two tabs refreshing at once do not log the user out.
  REFRESH_ROTATION_GRACE_SEC: z.coerce.number().int().nonnegative().default(10),

  // Exact frontend origin; CORS is locked to this with credentials.
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  // Number of proxies in front of the app, for express `trust proxy`.
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\nInvalid or missing environment configuration:\n${missing}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
