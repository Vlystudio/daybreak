import { timingSafeEqual } from "node:crypto";

/**
 * Pure (no server-only / env) constant-time secret matching for cron & admin
 * bearer auth. Kept separate from the request-level helper so it's unit-testable
 * without the env or Next request objects.
 */

/** Constant-time string compare. Length mismatch short-circuits to false. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Index of the first accepted secret matching the presented token
 * (0 = current, 1 = previous during rotation), or -1 if none match. An empty
 * token never matches; comparison is constant-time per candidate.
 */
export function matchCronSecret(presented: string, secrets: readonly string[]): number {
  if (!presented) return -1;
  for (let i = 0; i < secrets.length; i++) {
    if (secrets[i] && safeEqual(presented, secrets[i])) return i;
  }
  return -1;
}
