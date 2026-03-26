import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

let sentryInitialized = false;

export function initSentry(options?: {
  dsn?: string;
  environment?: string;
}): void {
  if (sentryInitialized) {
    return;
  }

  const dsn = options?.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set - error tracking disabled');
    return;
  }

  const environment = options?.environment ?? process.env.NODE_ENV ?? 'development';

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [nodeProfilingIntegration()],
  });

  sentryInitialized = true;
}
