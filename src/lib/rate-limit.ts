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
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
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
    console.error("[rate-limit] failed, allowing request:", err);
    return { ok: true };
  }
}

/** Standard limits used across the app. */
export const RATE_LIMITS = {
  mutation: { limit: 60, windowSeconds: 60 },
  aiSummary: { limit: 5, windowSeconds: 3600 },
  oauth: { limit: 10, windowSeconds: 600 },
  sync: { limit: 12, windowSeconds: 3600 },
  aiFitness: { limit: 25, windowSeconds: 86400 }, // daily cap on AI fitness generations
} as const;
