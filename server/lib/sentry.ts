// Sentry initialization. This file MUST be imported before any other server
// module so the SDK can monkey-patch http/express/pg for auto-instrumentation.
//
// Configure via env:
//   SENTRY_DSN          — required to actually send events (no-op if missing)
//   SENTRY_ENVIRONMENT  — optional, defaults to NODE_ENV or 'development'
//   SENTRY_TRACES_SAMPLE_RATE — optional float 0..1, defaults to 0 (errors only)

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0');

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    // Don't include the literal request body in error events — bench job
    // notes and chat messages may contain customer info.
    sendDefaultPii: false,
    // Drop noisy expected errors so they don't burn the free quota.
    ignoreErrors: [
      'Account pending approval',
      'Token quota exceeded',
      'Not authenticated',
    ],
  });
  console.log(`[sentry] initialized environment=${environment} traces=${tracesSampleRate}`);
} else {
  console.log('[sentry] SENTRY_DSN not set — error reporting disabled');
}

export { Sentry };
