import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initialize Sentry error monitoring for the Gateway Server.
 *
 * Call this function at the very beginning of main.ts, before
 * NestFactory.create(). This ensures all errors are captured,
 * including those during bootstrap.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nestjs/
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set – error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [nodeProfilingIntegration()],
  });
}
