import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { serverEnv } from "@/env";
import { matchCronSecret } from "./cron-auth-core";

/**
 * Shared bearer auth for Vercel-Cron and admin routes.
 *
 *  - Constant-time comparison (no inline `!==` timing leak).
 *  - Zero-downtime secret rotation: accepts CRON_SECRET and, optionally,
 *    CRON_SECRET_PREVIOUS.
 *  - Never logs the secret; emits a structured, secret-free denial log with a
 *    hashed IP (we deliberately do NOT write an audit row per failed attempt, to
 *    avoid turning the endpoint into a DB write-amplification/DoS vector).
 *
 * Vercel Cron sends a static `Authorization: Bearer <CRON_SECRET>` and supports
 * neither HMAC nor timestamps, so signed/replay-bound auth is not possible on
 * the cron GET routes without breaking the platform. Mutating ADMIN routes are
 * POST-only and additionally validate their inputs.
 */

export type CronAuthResult =
  | { ok: true; viaPrevious: boolean }
  | { ok: false; response: NextResponse };

function hashIp(request: NextRequest): string {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  if (!ip) return "none";
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

function acceptedSecrets(): string[] {
  const env = serverEnv();
  return [env.CRON_SECRET, env.CRON_SECRET_PREVIOUS].filter((s): s is string => Boolean(s));
}

/**
 * Verify the bearer token on a cron/admin request. Returns a ready 401 response
 * when auth fails; otherwise flags whether the previous (rotating) secret was used.
 */
export function verifyCronAuth(request: NextRequest, routeName: string): CronAuthResult {
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const matched = matchCronSecret(presented, acceptedSecrets());

  if (matched === -1) {
    console.warn(
      `[security] cron/admin auth denied route=${routeName} hasHeader=${header.length > 0} ip=${hashIp(request)}`
    );
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, viaPrevious: matched > 0 };
}
