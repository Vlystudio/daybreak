import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import {
  backfillObservationsForAllUsers,
  backfillObservationsForUser,
} from "@/lib/health/backfill-observations";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Admin-only, one-time backfill of health_observations from the legacy tables.
 * POST-only and gated by the shared cron/admin bearer auth (constant-time,
 * rotation-aware). Insert-only + idempotent, so re-running is safe.
 *
 * SAFE BY DEFAULT: a bare request is a DRY RUN. To actually write, pass an
 * explicit `?dryRun=false` (or `?write=1`).
 *
 *   POST /api/admin/backfill-observations                 → dry run, all users
 *   POST /api/admin/backfill-observations?dryRun=false     → write, all users
 *   POST /api/admin/backfill-observations?userId=…&write=1 → write, one user
 *   POST /api/admin/backfill-observations?limit=100&offset=0 → batch
 */
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const paramsSchema = z
  .object({
    userId: z.string().uuid().optional(),
    from: ymd.optional(),
    to: ymd.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
    dryRun: z.enum(["0", "1", "true", "false"]).optional(),
    write: z.enum(["1", "true"]).optional(),
  })
  .refine((v) => !(v.from && v.to) || v.from <= v.to, {
    message: "`from` must be on or before `to`",
    path: ["from"],
  });

export async function POST(request: NextRequest) {
  const auth = verifyCronAuth(request, "admin.backfill_observations");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    // Surface field-level issues only — never echo raw input back.
    return NextResponse.json(
      {
        error: "Invalid parameters",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 }
    );
  }
  const { userId, from, to, limit, offset, dryRun, write } = parsed.data;

  // Dry run is the default; a real write must be explicit.
  let isDryRun = true;
  if (dryRun != null) isDryRun = dryRun === "1" || dryRun === "true";
  if (write === "1" || write === "true") isDryRun = false;

  try {
    if (userId) {
      const result = await backfillObservationsForUser(userId, { from, to, dryRun: isDryRun });
      await audit(null, "admin.backfill_observations", {
        metadata: {
          scope: "user",
          userId,
          dryRun: isDryRun,
          planned: result.planned,
          inserted: result.inserted,
        },
      });
      return NextResponse.json({ ok: true, dryRun: isDryRun, result });
    }

    const summary = await backfillObservationsForAllUsers({
      from,
      to,
      dryRun: isDryRun,
      limit,
      offset,
    });
    await audit(null, "admin.backfill_observations", {
      metadata: {
        scope: "all",
        dryRun: isDryRun,
        usersScanned: summary.usersScanned,
        planned: summary.totals.planned,
        inserted: summary.totals.inserted,
        errors: summary.totals.errors,
      },
    });
    return NextResponse.json({ ok: true, dryRun: isDryRun, ...summary });
  } catch (err) {
    console.error(
      "[admin] backfill-observations failed:",
      err instanceof Error ? err.message : "unknown"
    );
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
