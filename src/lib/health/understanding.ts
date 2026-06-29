import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toKcal, toKg, toMeters, toPercent } from "@/lib/integrations/apple-health/aggregate";
import type {
  Confidence,
  HealthBaseline,
  HealthMetricName,
  HealthSource,
  HealthUnderstandingResult,
  RawHealthObservation,
} from "./types";
import { ALL_METRICS } from "./source-policies";
import { mergeObservationSources } from "./observation-mappers";
import { buildBaselines, type DatedValue } from "./baselines";
import { fuseDailySignals, latestSignals } from "./fusion";
import { confidenceLabel } from "./confidence";
import {
  dataQualityInsights,
  detectSourceConflicts,
  generateInsights,
  summarizeStatuses,
} from "./analysis";

/**
 * buildDailyHealthUnderstanding — the source-aware health intelligence entry
 * point. Reads exact, source-tagged rows from health_observations FIRST, then
 * fills any gaps from the legacy tables (Oura/Fitbit recovery in health_metrics;
 * Apple's per-type data in health_daily_samples + health_workouts; self-reports
 * in subjective_checkins and body_measurements). It fuses them per policy,
 * computes personal baselines, detects cross-tracker conflicts, and produces
 * honest, confidence-tagged insights — all deterministically, before any AI.
 *
 * Provenance note: health_observations stores each source's value as its own
 * row, so attribution is exact there. The legacy fallback is best-effort —
 * health_metrics is a merged store, so a value BOTH a wearable and Apple write
 * can't be attributed precisely; we credit it to the connected recovery wearable
 * and read Apple separately from health_daily_samples. Whenever any legacy row is
 * used, dataQuality carries a warning that source attribution may be approximate.
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
}

// health_metrics column → canonical metric.
const HM_COLUMN_TO_METRIC: Partial<Record<string, HealthMetricName>> = {
  readiness_score: "readiness_score",
  sleep_score: "sleep_score",
  sleep_duration_min: "sleep_duration_min",
  sleep_efficiency: "sleep_efficiency",
  deep_sleep_min: "deep_sleep_min",
  rem_sleep_min: "rem_sleep_min",
  light_sleep_min: "light_sleep_min",
  hrv_avg: "hrv",
  resting_hr: "resting_hr",
  body_temperature_delta: "body_temperature_delta",
  respiratory_rate: "respiratory_rate",
  spo2_avg: "spo2_avg",
  steps: "steps",
  active_calories: "active_calories",
  exercise_minutes: "exercise_minutes",
  distance_m: "distance_m",
  stand_hours: "stand_hours",
  weight_kg: "weight_kg",
  body_fat_pct: "body_fat_pct",
  vo2max: "vo2max",
};

// Metrics Apple also provides via health_daily_samples — so in Apple-only mode
// we don't duplicate them out of health_metrics.
const APPLE_SAMPLE_COVERED = new Set<HealthMetricName>([
  "hrv",
  "resting_hr",
  "spo2_avg",
  "respiratory_rate",
  "steps",
  "active_calories",
  "exercise_minutes",
  "distance_m",
  "weight_kg",
  "body_fat_pct",
  "vo2max",
]);

interface SampleRule {
  metric: HealthMetricName;
  agg: "sum" | "avg";
  convert?: (v: number, unit: string) => number;
}
const SAMPLE_TYPE_TO_METRIC: Record<string, SampleRule> = {
  HKQuantityTypeIdentifierStepCount: { metric: "steps", agg: "sum" },
  HKQuantityTypeIdentifierDistanceWalkingRunning: {
    metric: "distance_m",
    agg: "sum",
    convert: toMeters,
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric: "active_calories",
    agg: "sum",
    convert: toKcal,
  },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { metric: "hrv", agg: "avg" },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: "resting_hr", agg: "avg" },
  HKQuantityTypeIdentifierRespiratoryRate: { metric: "respiratory_rate", agg: "avg" },
  HKQuantityTypeIdentifierOxygenSaturation: {
    metric: "spo2_avg",
    agg: "avg",
    convert: (v) => toPercent(v),
  },
  HKQuantityTypeIdentifierAppleExerciseTime: { metric: "exercise_minutes", agg: "sum" },
  HKQuantityTypeIdentifierBodyMass: { metric: "weight_kg", agg: "avg", convert: toKg },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metric: "body_fat_pct",
    agg: "avg",
    convert: (v) => toPercent(v),
  },
  HKQuantityTypeIdentifierVO2Max: { metric: "vo2max", agg: "avg" },
};

interface HealthMetricRow {
  date: string;
  [col: string]: number | string | null;
}
interface SampleRow {
  date: string;
  type: string;
  unit: string | null;
  sum: number | null;
  avg: number | null;
}
interface WorkoutRow {
  started_at: string;
}
interface CheckinRow {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
}
interface BodyRow {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
}

/** One row of the health_observations table (subset we read). */
interface ObservationTableRow {
  source: string;
  source_device: string | null;
  metric: string;
  value_numeric: number | null;
  unit: string | null;
  start_time: string | null;
  end_time: string | null;
  date_local: string;
  imported_at: string | null;
  metadata: Record<string, unknown> | null;
}

const FUSION_METRIC_SET = new Set<string>(ALL_METRICS);

/**
 * Load EXACT, source-tagged observations from health_observations. Only numeric
 * fusion metrics are returned (text notes/symptoms are stored but not fused).
 * Resilient: if the table is unavailable (e.g. migration not yet applied), this
 * returns empty so the legacy fallback keeps the page working.
 */
async function loadFromObservationsTable(
  userId: string,
  from: string,
  to: string
): Promise<{ observations: RawHealthObservation[]; sources: Set<HealthSource> }> {
  const admin = createAdminClient();
  const observations: RawHealthObservation[] = [];
  const sources = new Set<HealthSource>();
  try {
    const { data, error } = await admin
      .from("health_observations")
      .select(
        "source, source_device, metric, value_numeric, unit, start_time, end_time, date_local, imported_at, metadata"
      )
      .eq("user_id", userId)
      .gte("date_local", from)
      .lte("date_local", to)
      .returns<ObservationTableRow[]>();
    if (error) return { observations, sources };
    for (const r of data ?? []) {
      if (!FUSION_METRIC_SET.has(r.metric)) continue;
      if (typeof r.value_numeric !== "number" || !Number.isFinite(r.value_numeric)) continue;
      const source = r.source as HealthSource;
      sources.add(source);
      observations.push({
        userId,
        date: r.date_local,
        metric: r.metric as HealthMetricName,
        source,
        sourceDevice: r.source_device,
        value: r.value_numeric,
        unit: r.unit,
        startTime: r.start_time,
        endTime: r.end_time,
        importedAt: r.imported_at,
        metadata: r.metadata ?? undefined,
      });
    }
  } catch {
    // Table missing or transient error — fall back to legacy entirely.
    return { observations: [], sources: new Set() };
  }
  return { observations, sources };
}

/**
 * Observations-first loader: prefer exact rows from health_observations, fill
 * gaps from the legacy tables. `usedLegacy` is true when any legacy row was
 * needed, which the caller surfaces as a data-quality warning.
 */
async function loadObservations(
  userId: string,
  from: string,
  to: string
): Promise<{
  observations: RawHealthObservation[];
  connectedSources: HealthSource[];
  usedLegacy: boolean;
}> {
  const [primary, legacy] = await Promise.all([
    loadFromObservationsTable(userId, from, to),
    loadLegacyObservations(userId, from, to),
  ]);

  const { observations, usedLegacy } = mergeObservationSources(
    primary.observations,
    legacy.observations
  );

  // Connected sources: anything we actually have exact observations from, plus
  // the legacy-derived connections (covers a freshly connected source before its
  // first observation lands, and keeps "manual" present).
  const connectedSources = [
    ...new Set<HealthSource>([...primary.sources, ...legacy.connectedSources]),
  ];

  return { observations, connectedSources, usedLegacy };
}

/**
 * Load source-tagged observations from the legacy health tables (fallback for
 * the understanding layer, and the source of truth for the one-time backfill).
 */
export async function loadLegacyObservations(
  userId: string,
  from: string,
  to: string
): Promise<{ observations: RawHealthObservation[]; connectedSources: HealthSource[] }> {
  const admin = createAdminClient();

  const [conns, hm, samples, workouts, checkins, body, imports] = await Promise.all([
    admin
      .from("oauth_connections")
      .select("provider")
      .eq("user_id", userId)
      .returns<{ provider: string }[]>(),
    admin
      .from("health_metrics")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .returns<HealthMetricRow[]>(),
    admin
      .from("health_daily_samples")
      .select("date, type, unit, sum, avg")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .returns<SampleRow[]>(),
    admin
      .from("health_workouts")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", `${from}T00:00:00Z`)
      .lte("started_at", `${to}T23:59:59Z`)
      .returns<WorkoutRow[]>(),
    admin
      .from("subjective_checkins")
      .select("date, mood, energy, stress, soreness")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .returns<CheckinRow[]>(),
    admin
      .from("body_measurements")
      .select("date, weight_kg, body_fat_pct")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .returns<BodyRow[]>(),
    admin
      .from("apple_health_imports")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .returns<{ id: string }[]>(),
  ]);

  const providers = new Set((conns.data ?? []).map((c) => c.provider));
  const hasApple = (imports.data ?? []).length > 0 || (samples.data ?? []).length > 0;
  const recoveryWearable: HealthSource | null = providers.has("oura")
    ? "oura"
    : providers.has("fitbit")
      ? "fitbit"
      : null;

  const connectedSources: HealthSource[] = [];
  if (recoveryWearable) connectedSources.push(recoveryWearable);
  if (hasApple) connectedSources.push("apple_health");
  connectedSources.push("manual");

  const obs: RawHealthObservation[] = [];
  const push = (o: Omit<RawHealthObservation, "userId">) => obs.push({ userId, ...o });

  // health_metrics → recovery wearable (or Apple-only fallback for non-sample metrics).
  for (const row of hm.data ?? []) {
    for (const [col, metric] of Object.entries(HM_COLUMN_TO_METRIC)) {
      if (!metric) continue;
      const raw = row[col];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const source: HealthSource = recoveryWearable ?? "apple_health";
      // Apple-only: skip metrics already coming from health_daily_samples.
      if (!recoveryWearable && APPLE_SAMPLE_COVERED.has(metric)) continue;
      push({ date: row.date, metric, source, value: raw, importedAt: null });
    }
  }

  // health_daily_samples → Apple (unit-converted to match health_metrics).
  for (const s of samples.data ?? []) {
    const rule = SAMPLE_TYPE_TO_METRIC[s.type];
    if (!rule) continue;
    const base = rule.agg === "sum" ? s.sum : s.avg;
    if (base == null || !Number.isFinite(base)) continue;
    const value = rule.convert ? rule.convert(base, s.unit ?? "") : base;
    push({
      date: s.date,
      metric: rule.metric,
      source: "apple_health",
      value: Math.round(value * 100) / 100,
      unit: s.unit,
    });
  }

  // health_workouts → Apple workout count per local day.
  const workoutsByDay = new Map<string, number>();
  for (const w of workouts.data ?? []) {
    const d = w.started_at.slice(0, 10);
    workoutsByDay.set(d, (workoutsByDay.get(d) ?? 0) + 1);
  }
  for (const [date, count] of workoutsByDay) {
    push({ date, metric: "workouts", source: "apple_health", value: count });
  }

  // subjective_checkins → manual.
  for (const c of checkins.data ?? []) {
    for (const metric of ["mood", "energy", "stress", "soreness"] as const) {
      const v = c[metric];
      if (typeof v === "number") push({ date: c.date, metric, source: "manual", value: v });
    }
  }

  // body_measurements → manual.
  for (const b of body.data ?? []) {
    if (typeof b.weight_kg === "number")
      push({ date: b.date, metric: "weight_kg", source: "manual", value: b.weight_kg });
    if (typeof b.body_fat_pct === "number")
      push({ date: b.date, metric: "body_fat_pct", source: "manual", value: b.body_fat_pct });
  }

  return { observations: obs, connectedSources };
}

/** Group numeric observations into per-metric chronological series for baselines. */
function seriesByMetric(observations: RawHealthObservation[]): Map<HealthMetricName, DatedValue[]> {
  // Per (metric, date), prefer the policy-primary source's value via the fused signal;
  // for baselines we just need a representative daily value, so collapse to the mean
  // of present numeric sources per day (baselines are about the user's own trend).
  const byMetricDate = new Map<
    string,
    { metric: HealthMetricName; date: string; sum: number; n: number }
  >();
  for (const o of observations) {
    if (typeof o.value !== "number" || !Number.isFinite(o.value)) continue;
    const k = `${o.metric}|${o.date}`;
    const cur = byMetricDate.get(k) ?? { metric: o.metric, date: o.date, sum: 0, n: 0 };
    cur.sum += o.value;
    cur.n += 1;
    byMetricDate.set(k, cur);
  }
  const out = new Map<HealthMetricName, DatedValue[]>();
  for (const { metric, date, sum, n } of byMetricDate.values()) {
    const list = out.get(metric) ?? [];
    list.push({ date, value: sum / n });
    out.set(metric, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export async function buildDailyHealthUnderstanding(
  userId: string,
  from: Date,
  to: Date
): Promise<HealthUnderstandingResult> {
  const fromStr = isoDate(from);
  const toStr = isoDate(to);

  const { observations, connectedSources, usedLegacy } = await loadObservations(
    userId,
    fromStr,
    toStr
  );

  const baselines = buildBaselines(seriesByMetric(observations));
  const baselineMap = new Map<HealthMetricName, HealthBaseline>(
    baselines.map((b) => [b.metric, b])
  );

  const dailySignals = fuseDailySignals(observations, { baselines: baselineMap, connectedSources });
  const latest = latestSignals(dailySignals);

  const sourceConflicts = detectSourceConflicts(dailySignals);
  const ctx = { latest, baselines: baselineMap };
  const insights = [...generateInsights(ctx), ...dataQualityInsights(baselineMap, sourceConflicts)];
  const statuses = summarizeStatuses(ctx);

  // Data quality.
  const totalDays = daysBetween(fromStr, toStr);
  const coverageByMetric: Record<string, number> = {};
  const daysWithMetric = new Map<HealthMetricName, Set<string>>();
  for (const s of dailySignals) {
    if (s.value == null) continue;
    const set = daysWithMetric.get(s.metric) ?? new Set<string>();
    set.add(s.date);
    daysWithMetric.set(s.metric, set);
  }
  for (const metric of ALL_METRICS) {
    coverageByMetric[metric] =
      Math.round(((daysWithMetric.get(metric)?.size ?? 0) / totalDays) * 100) / 100;
  }

  const latestScores = [...latest.values()].map((s) => s.confidenceScore);
  const overallConfidence: Confidence = latestScores.length
    ? confidenceLabel(latestScores.reduce((a, b) => a + b, 0) / latestScores.length)
    : "low";

  const allSources: HealthSource[] = ["oura", "apple_health", "manual"];
  const missingSources = allSources.filter((s) => !connectedSources.includes(s)).map(String);

  const warnings: string[] = [];
  if (usedLegacy) {
    warnings.push(
      "Some health data came from legacy merged tables, so source attribution may be approximate."
    );
  }
  if (!connectedSources.some((s) => s === "oura" || s === "fitbit" || s === "apple_health")) {
    warnings.push(
      "No wearable connected — connect Oura or Apple Health for recovery, sleep, and activity data."
    );
  }
  if (!connectedSources.includes("oura")) {
    warnings.push(
      "Oura not connected — readiness, sleep score, and overnight HRV are unavailable or lower confidence."
    );
  }
  for (const c of sourceConflicts.filter((c) => c.severity !== "minor").slice(0, 3)) {
    warnings.push(c.message);
  }

  const topInsights = [...insights]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 3);

  return {
    dateRange: { from: fromStr, to: toStr },
    dailySignals,
    baselines,
    insights,
    sourceConflicts,
    dataQuality: {
      overallConfidence,
      connectedSources: connectedSources.map(String),
      missingSources,
      coverageByMetric,
      warnings,
    },
    summary: { ...statuses, topInsights },
  };
}

function severityRank(s: string): number {
  return s === "warning" ? 0 : s === "watch" ? 1 : s === "positive" ? 2 : 3;
}
