import * as Sentry from "@sentry/nextjs";

/**
 * Sentry browser initialization. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set.
 * Session Replay is disabled and PII capture is off by default.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}
