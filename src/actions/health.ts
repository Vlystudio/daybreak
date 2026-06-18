"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { computeHeadsUp } from "@/lib/health-insights";
import { analyzeHealthTrends, type HealthAnalysis } from "@/lib/integrations/ai";
import type { HealthMetric } from "@/lib/types";

export type AnalyzeResult = { ok: true; analysis: HealthAnalysis } | { ok: false; error: string };

const METRIC_COLUMNS =
  "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, body_temperature_delta";

/** On-demand AI read of the last ~30 days of metrics. Tightly rate-limited. */
export async function analyzeHealth(): Promise<AnalyzeResult> {
  const user = await requireUser();

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "Analysis limit reached for now — try again a little later." };
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: metrics } = await supabase
    .from("health_metrics")
    .select(METRIC_COLUMNS)
    .eq("user_id", user.id)
    .gte("date", since)
    .order("date", { ascending: true })
    .returns<HealthMetric[]>();

  const rows = metrics ?? [];
  if (rows.length < 3) {
    return { ok: false, error: "Not enough data yet — give Oura a few more nights to sync." };
  }

  const flags = computeHeadsUp(rows);
  const analysis = await analyzeHealthTrends({
    metrics: rows as unknown as Record<string, unknown>[],
    flags: flags.map((f) => ({ title: f.title, detail: f.detail })),
  });
  if (!analysis) {
    return { ok: false, error: "Couldn't analyze your trends right now — please try again." };
  }

  await audit(user.id, "health.analyzed", { metadata: { days: rows.length } });
  return { ok: true, analysis };
}
