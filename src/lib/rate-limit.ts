import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limiter backed by Postgres (works across serverless
 * instances). Fails open on infrastructure errors so a database hiccup
 * doesn't take the whole app down, but logs loudly.
 */

type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function rateLimit(
  key: string,
  {
    limit,
    windowSeconds,
    failClosed = false,
  }: { limit: number; windowSeconds: number; failClosed?: boolean }
): Promise<RateLimitResult> {
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000
  ).toISOString();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("increment_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
    });

    if (error) throw error;

    const count = data as number;
    if (count > limit) {
      const windowEnd = new Date(Date.parse(windowStart) + windowSeconds * 1000);
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000)),
      };
    }
    return { ok: true };
  } catch (err) {
    // Default is fail-OPEN: a database blip shouldn't take the whole app down.
    // But cost- or security-sensitive limits opt into fail-CLOSED so an attacker
    // who can induce an infra error can't use that to bypass the limit.
    console.error(`[rate-limit] backend error (failClosed=${failClosed}):`, err);
    if (failClosed) return { ok: false, retryAfterSeconds: 30 };
    return { ok: true };
  }
}

/** Standard limits used across the app. */
export const RATE_LIMITS = {
  mutation: { limit: 60, windowSeconds: 60 },
  oauth: { limit: 10, windowSeconds: 600 },
  sync: { limit: 12, windowSeconds: 3600 },
  // Apple Health export imports stream in many small chunks, so this is far
  // more generous than `sync` — one large export can be a few hundred chunks.
  appleImport: { limit: 600, windowSeconds: 3600 },
  // The AI limits guard real OpenAI spend, so they fail CLOSED — better to make a
  // user retry than to let a forced infra error run up the bill.
  aiSummary: { limit: 5, windowSeconds: 3600, failClosed: true },
  aiFitness: { limit: 25, windowSeconds: 86400, failClosed: true }, // daily cap on AI fitness generations
  aiMeals: { limit: 15, windowSeconds: 86400, failClosed: true }, // daily cap on AI meal-plan generations
  aiChat: { limit: 40, windowSeconds: 3600, failClosed: true }, // health check-in conversation turns
  aiVision: { limit: 30, windowSeconds: 3600, failClosed: true }, // food-photo nutrition analyses
  // High-risk account/security mutations fail CLOSED — an attacker who can induce
  // an infra error must not be able to bypass these.
  accountDelete: { limit: 3, windowSeconds: 3600, failClosed: true },
  dataExport: { limit: 6, windowSeconds: 3600, failClosed: true },
  disconnect: { limit: 12, windowSeconds: 600, failClosed: true },
} as const;

/**
 * Fail-CLOSED rate limit for sensitive/high-risk paths. Identical to
 * {@link rateLimit} but defaults `failClosed: true`, so a limiter-backend outage
 * blocks rather than waves the request through.
 */
export function securityRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  return rateLimit(key, { ...opts, failClosed: true });
}
