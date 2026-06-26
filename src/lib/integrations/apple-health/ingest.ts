import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLE_METRIC_FIELDS } from "./types";
import {
  chunkSchema,
  summarySchema,
  type AppleHealthChunk,
  type ChunkResult,
  type ImportSummary,
} from "./schema";

/**
 * Server-side persistence for Apple Health imports, shared by the Phase 1 export
 * upload (Server Action) and the Phase 2 native HealthKit ingest route. Writes
 * to the sync-owned tables via the service role, always scoped to a userId the
 * caller has already authenticated. Never trusts a client-supplied user id.
 */

// health_metrics columns with a bounded DB CHECK — clamp so one out-of-range
// value can't fail the whole chunk's upsert.
const BOUNDS: Record<string, [number, number]> = {
  sleep_efficiency: [0, 100],
  spo2_avg: [0, 100],
  body_fat_pct: [0, 100],
  stand_hours: [0, 24],
};

function sanitizeMetric(row: Record<string, unknown>): Record<string, number | string> {
  const out: Record<string, number | string> = { date: row.date as string };
  for (const field of APPLE_METRIC_FIELDS) {
    const v = row[field];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const bound = BOUNDS[field];
    out[field] = bound ? Math.min(bound[1], Math.max(bound[0], v)) : Math.max(0, v);
  }
  return out;
}

/** Group rows by which metric columns they carry, so a heterogeneous bulk
 *  upsert can't null out a column another provider (Oura/Fitbit) already wrote
 *  — ON CONFLICT only SETs the columns present in each homogeneous group. */
function groupBySignature(
  rows: Record<string, number | string>[]
): Map<string, Record<string, number | string>[]> {
  const groups = new Map<string, Record<string, number | string>[]>();
  for (const row of rows) {
    const sig = Object.keys(row)
      .filter((k) => k !== "date")
      .sort()
      .join(",");
    if (sig === "") continue; // date only, nothing to write
    const g = groups.get(sig);
    if (g) g.push(row);
    else groups.set(sig, [row]);
  }
  return groups;
}

/** Validate and upsert one chunk of import data for an authenticated user. */
export async function upsertAppleHealthChunk(
  userId: string,
  chunk: AppleHealthChunk
): Promise<ChunkResult> {
  const parsed = chunkSchema.safeParse(chunk);
  if (!parsed.success)
    return { ok: false, error: "That import data wasn't in the expected shape." };
  const { metrics = [], workouts = [], samples = [] } = parsed.data;

  const admin = createAdminClient();

  // ── Metrics → health_metrics (partial merge per column signature) ──────────
  let metricsWritten = 0;
  for (const group of groupBySignature(metrics.map(sanitizeMetric)).values()) {
    const payload = group.map((r) => ({ user_id: userId, ...r }));
    const { error } = await admin
      .from("health_metrics")
      .upsert(payload, { onConflict: "user_id,date" });
    if (error) return { ok: false, error: "Couldn't save daily metrics." };
    metricsWritten += payload.length;
  }

  // ── Workouts → health_workouts ─────────────────────────────────────────────
  if (workouts.length > 0) {
    const payload = workouts.map((w) => ({
      user_id: userId,
      source: "apple",
      external_id: w.external_id,
      activity_type: w.activity_type,
      started_at: w.started_at,
      ended_at: w.ended_at,
      duration_sec: w.duration_sec,
      distance_m: w.distance_m,
      active_energy_kcal: w.active_energy_kcal,
      total_energy_kcal: w.total_energy_kcal,
      avg_hr: w.avg_hr,
      max_hr: w.max_hr,
      metadata: w.metadata ?? {},
    }));
    const { error } = await admin
      .from("health_workouts")
      .upsert(payload, { onConflict: "user_id,source,external_id" });
    if (error) return { ok: false, error: "Couldn't save workouts." };
  }

  // ── Samples → health_daily_samples (the long tail) ─────────────────────────
  if (samples.length > 0) {
    const now = new Date().toISOString();
    const payload = samples.map((s) => ({ user_id: userId, updated_at: now, ...s }));
    const { error } = await admin
      .from("health_daily_samples")
      .upsert(payload, { onConflict: "user_id,date,type" });
    if (error) return { ok: false, error: "Couldn't save health samples." };
  }

  return { ok: true, metrics: metricsWritten, workouts: workouts.length, samples: samples.length };
}

/** Record a completed import (status + totals). Doubles as the "Apple Health
 *  connected" signal, since there are no OAuth tokens to store. */
export async function recordAppleHealthImport(
  userId: string,
  summary: ImportSummary
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = summarySchema.safeParse(summary);
  if (!parsed.success) return { ok: false, error: "Invalid import summary." };
  const s = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("apple_health_imports").insert({
    user_id: userId,
    source: s.source,
    file_name: s.fileName ?? null,
    range_start: s.rangeStart,
    range_end: s.rangeEnd,
    metrics_days: s.metricsDays,
    workouts: s.workouts,
    samples: s.samples,
    status: "completed",
  });
  if (error) return { ok: false, error: "Couldn't record the import." };
  return { ok: true };
}
