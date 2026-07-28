"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

/**
 * Import daily health metrics from a compatible CSV exported elsewhere. Writes to health_metrics via the
 * service role — scoped to the signed-in user — since that table is sync-owned.
 * Existing values for a date are preserved unless the row provides them.
 */

const num = z.number().finite().nullable().optional();

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readiness_score: num,
  sleep_score: num,
  steps: num,
  resting_hr: num,
  hrv_avg: num,
  sleep_duration_min: num,
  active_calories: num,
});

export type ImportRow = z.input<typeof rowSchema>;

const METRIC_KEYS = [
  "readiness_score",
  "sleep_score",
  "steps",
  "resting_hr",
  "hrv_avg",
  "sleep_duration_min",
  "active_calories",
] as const;

export type ImportResult = { ok: true; imported: number } | { ok: false; error: string };

export async function importHealthMetrics(rows: ImportRow[]): Promise<ImportResult> {
  const user = await requireUser();

  const limited = await rateLimit(`sync:${user.id}`, RATE_LIMITS.sync);
  if (!limited.ok)
    return { ok: false, error: "You've imported a lot recently — try again shortly." };

  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 2000)
    return { ok: false, error: "That's a lot of rows — split it under 2000." };

  const clean: Record<string, number | string>[] = [];
  for (const raw of rows) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const d = parsed.data;
    // Keep date plus only the metric fields actually provided (partial upsert).
    const row: Record<string, number | string> = { user_id: user.id, date: d.date };
    let hasMetric = false;
    for (const k of METRIC_KEYS) {
      const v = d[k];
      if (typeof v === "number") {
        row[k] = Math.round(k === "hrv_avg" ? v * 10 : v) / (k === "hrv_avg" ? 10 : 1);
        hasMetric = true;
      }
    }
    if (hasMetric) clean.push(row);
  }

  if (clean.length === 0) return { ok: false, error: "No recognizable metric columns found." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("health_metrics")
    .upsert(clean, { onConflict: "user_id,date" });
  if (error) return { ok: false, error: "Couldn't import that data." };

  await audit(user.id, "health.imported", { metadata: { rows: clean.length } });
  revalidatePath("/health");
  return { ok: true, imported: clean.length };
}
