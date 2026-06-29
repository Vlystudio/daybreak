import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { audit } from "@/lib/audit";
import {
  backfillObservationsForAllUsers,
  backfillObservationsForUser,
} from "@/lib/health/backfill-observations";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Admin-only, one-time backfill of health_observations from the legacy tables.
 * Gated by the same CRON_SECRET bearer token as the cron jobs. Insert-only and
 * idempotent, so it's safe to re-run.
 *
 *   POST /api/admin/backfill-observations                  → all users
 *   POST /api/admin/backfill-observations?dryRun=1         → report counts, no writes
 *   POST /api/admin/backfill-observations?userId=…          → a single user
 *   POST /api/admin/backfill-observations?limit=100&offset=0 → batch all-users
 */
export async function POST(request: NextRequest) {
  // Reject when the secret is unset (so "Bearer undefined"/"Bearer " can't match)
  // or when the bearer token doesn't match exactly.
  const secret = serverEnv().CRON_SECRET;
  const authorized = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const userId = url.searchParams.get("userId");
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = limitParam != null && /^\d+$/.test(limitParam) ? Number(limitParam) : undefined;
  const offset = offsetParam != null && /^\d+$/.test(offsetParam) ? Number(offsetParam) : undefined;

  try {
    if (userId) {
      const result = await backfillObservationsForUser(userId, { from, to, dryRun });
      await audit(null, "admin.backfill_observations", {
        metadata: {
          scope: "user",
          userId,
          dryRun,
          planned: result.planned,
          inserted: result.inserted,
        },
      });
      return NextResponse.json({ ok: true, dryRun, result });
    }

    const summary = await backfillObservationsForAllUsers({ from, to, dryRun, limit, offset });
    await audit(null, "admin.backfill_observations", {
      metadata: {
        scope: "all",
        dryRun,
        usersScanned: summary.usersScanned,
        planned: summary.totals.planned,
        inserted: summary.totals.inserted,
        errors: summary.totals.errors,
      },
    });
    return NextResponse.json({ ok: true, dryRun, ...summary });
  } catch (err) {
    console.error("[admin] backfill-observations failed:", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
