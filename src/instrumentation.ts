import * as Sentry from "@sentry/nextjs";
import { isProcessorEnabled } from "@/lib/privacy/processors";
import { scrubSentryEvent } from "@/lib/security/sentry-scrub";

/**
 * Sentry server/edge initialization. No-ops unless NEXT_PUBLIC_SENTRY_DSN is
 * set, so dev and unconfigured deploys are unaffected.
 *
 * PII capture is OFF — Sentry receives error messages and stack traces, never
 * request bodies, prompts, or health data. (Source-map upload / release tagging
 * would need the Sentry build plugin; this runtime-only setup is intentionally
 * Turbopack-safe and can be upgraded later.)
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || !isProcessorEnabled("sentry")) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
      beforeSendTransaction: scrubSentryEvent,
    });
  }
}

// Reports uncaught errors thrown in the React Server Component / route layer.
export const onRequestError = Sentry.captureRequestError;
