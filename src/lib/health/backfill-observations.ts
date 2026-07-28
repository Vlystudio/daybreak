import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLegacyObservations } from "./understanding";
import {
  dedupeObservations,
  legacyObservationsToBackfillRows,
  upsertHealthObservations,
} from "./observations";
import type { SourceAttribution } from "./observation-mappers";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

/**
 * One-time (idempotent) backfill of health_observations from the legacy tables.
 *
 * It reuses the SAME derivation the understanding layer falls back to
 * (`loadLegacyObservations`), so attribution matches exactly: each row is tagged
 * with `metadata.backfilled = true` and a `source_attribution` of either
 * "exact" (Apple's own per-type data and manual self-reports) or
 * "legacy_best_effort" (values read from the merged health_metrics store, where
 * a wearable and Apple can't be told apart).
 *
 * Safety:
 *  - INSERT-ONLY (ignoreDuplicates): seeding history never overwrites a newer
 *    exact observation, and re-running inserts nothing.
 *  - Dry-run writes nothing at all.
 *  - All-user runs are batchable via limit/offset so a large account base can't
 *    be processed in one unbounded pass.
 *
 * Admin-only: the sole HTTP entry point is the CRON_SECRET-gated route.
 */

export interface BackfillResult {
  userId: string;
  planned: number; // distinct rows that would be written (post-dedupe)
  inserted: number; // rows actually inserted (0 in dry-run)
  duplicates: number; // planned rows that already existed (0 in dry-run)
  dryRun: boolean;
  bySource: Record<string, number>;
  byAttribution: Record<SourceAttribution, number>;
  error?: string;
}

export interface BackfillOptions {
  /** Inclusive local-date lower bound. Defaults to ~5 years ago. */
  from?: string;
  /** Inclusive local-date upper bound. Defaults to today (UTC). */
  to?: string;
  dryRun?: boolean;
}

export interface AllUsersBackfillOptions extends BackfillOptions {
  /** Max users to process this run (batching). */
  limit?: number;
  /** Users to skip before processing (batching cursor). */
  offset?: number;
}

export interface AllUsersBackfillSummary {
  usersScanned: number;
  totals: {
    planned: number;
    inserted: number;
    duplicates: number;
    exact: number;
    legacy_best_effort: number;
    errors: number;
  };
  results: BackfillResult[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Backfill one user's observations from their legacy rows (insert-only). */
export async function backfillObservationsForUser(
  userId: string,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const to = options.to ?? isoDate(new Date());
  const from = options.from ?? isoDate(new Date(Date.now() - 5 * 365 * 86_400_000));
  const dryRun = options.dryRun ?? false;

  const { observations } = await loadLegacyObservations(userId, from, to);
  const { rows, bySource, byAttribution } = legacyObservationsToBackfillRows(userId, observations);

  // Planned = distinct rows after collapsing to the daily grain (what we'd write).
  const planned = dedupeObservations(rows).length;
  const inserted = dryRun ? 0 : await upsertHealthObservations(rows, { ignoreDuplicates: true });
  const duplicates = dryRun ? 0 : Math.max(0, planned - inserted);

  return { userId, planned, inserted, duplicates, dryRun, bySource, byAttribution };
}

/**
 * Backfill users who have a profile, in a bounded batch. Per-user failures are
 * captured (never abort the whole run) and surfaced in the result + totals.
 */
export async function backfillObservationsForAllUsers(
  options: AllUsersBackfillOptions = {}
): Promise<AllUsersBackfillSummary> {
  const admin = createAdminClient();

  let query = admin.from("profiles").select("id").order("id", { ascending: true });
  const offset = options.offset ?? 0;
  if (options.limit != null) {
    query = query.range(offset, offset + options.limit - 1);
  } else if (offset > 0) {
    // Offset without a limit: skip the first `offset` rows up to a large cap.
    query = query.range(offset, offset + 100_000);
  }

  const { data, error } = await query.returns<{ id: string }[]>();
  if (error) throw new Error(`Backfill: failed to list users: ${error.message}`);

  const results: BackfillResult[] = [];
  const totals = {
    planned: 0,
    inserted: 0,
    duplicates: 0,
    exact: 0,
    legacy_best_effort: 0,
    errors: 0,
  };

  for (const { id } of data ?? []) {
    try {
      const r = await backfillObservationsForUser(id, options);
      results.push(r);
      totals.planned += r.planned;
      totals.inserted += r.inserted;
      totals.duplicates += r.duplicates;
      totals.exact += r.byAttribution.exact;
      totals.legacy_best_effort += r.byAttribution.legacy_best_effort;
    } catch (err) {
      totals.errors += 1;
      safeLog("error", "health.observation_backfill_user_failed", {
        errorClass: errorClass(err),
      });
      results.push({
        userId: id,
        planned: 0,
        inserted: 0,
        duplicates: 0,
        dryRun: options.dryRun ?? false,
        bySource: {},
        byAttribution: { exact: 0, legacy_best_effort: 0 },
        error: "backfill_failed",
      });
    }
  }

  return { usersScanned: results.length, totals, results };
}
