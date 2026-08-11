import * as Sentry from '@sentry/node';
import { env, isProd } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Error monitoring sink. When SENTRY_DSN is set, unexpected errors are reported
 * to Sentry (a real sink, not a swallowed console line). When it is not set the
 * calls are inert — the app still runs — and in production a single warning is
 * logged at boot so a missing DSN is visible rather than silent.
 */
let enabled = false;

export function initMonitoring(): void {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      // Errors only — no performance tracing by default.
      tracesSampleRate: 0,
    });
    enabled = true;
    logger.info('Error monitoring enabled (Sentry)');
  } else if (isProd) {
    logger.warn('SENTRY_DSN is not set — error monitoring is disabled');
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/** Flush buffered events before the process exits (best-effort). */
export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Never let telemetry flushing block or crash shutdown.
  }
}
