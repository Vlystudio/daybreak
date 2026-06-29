import type { HealthMetricName, HealthSource, MetricCategory } from "./types";

/**
 * Deterministic, source-aware policy for each metric: which tracker is the
 * trusted primary, how inherently reliable the metric is, and special handling
 * (calories are never high-confidence; HRV is never averaged across sources
 * because the measurement windows differ).
 */
export interface MetricPolicy {
  metric: HealthMetricName;
  category: MetricCategory;
  /** Preference order for the primary source; first present source wins. */
  preferredSources: HealthSource[];
  /** How trustworthy this metric is even from its best source. */
  inherentReliability: "high" | "medium" | "low";
  /** Calories/energy: a rough estimate — cap confidence below "high". */
  neverHighConfidence?: boolean;
  /** HRV: sources measure different windows — keep separate, never average. */
  doNotAverage?: boolean;
  /** SpO₂, respiratory rate, temperature: watchlist/trend, not diagnostic. */
  trendOnly?: boolean;
  /** Disagreement thresholds for conflict detection (absolute and/or percent). */
  disagreement?: { abs?: number; pct?: number };
  /** Higher value = better (steps, hrv) vs lower = better (resting hr, stress). */
  higherIsBetter?: boolean;
  unit?: string;
}

const OURA_RECOVERY: HealthSource[] = ["oura", "fitbit", "apple_health", "apple_watch"];
const APPLE_ACTIVITY: HealthSource[] = ["apple_watch", "apple_health", "fitbit", "oura"];
const MANUAL_ONLY: HealthSource[] = ["manual"];

const POLICIES: Record<HealthMetricName, MetricPolicy> = {
  // ── Sleep & recovery — Oura primary ────────────────────────────────────────
  sleep_duration_min: {
    metric: "sleep_duration_min",
    category: "sleep",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "high",
    higherIsBetter: true,
    unit: "min",
    disagreement: { abs: 60 },
  },
  sleep_score: {
    metric: "sleep_score",
    category: "sleep",
    preferredSources: ["oura"],
    inherentReliability: "high",
    higherIsBetter: true,
  },
  sleep_efficiency: {
    metric: "sleep_efficiency",
    category: "sleep",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "%",
    disagreement: { abs: 8 },
  },
  // Sleep stages are medium confidence at best — fine for trends, not exact claims.
  deep_sleep_min: {
    metric: "deep_sleep_min",
    category: "sleep",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "min",
    disagreement: { pct: 35 },
  },
  rem_sleep_min: {
    metric: "rem_sleep_min",
    category: "sleep",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "min",
    disagreement: { pct: 35 },
  },
  light_sleep_min: {
    metric: "light_sleep_min",
    category: "sleep",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "min",
    disagreement: { pct: 35 },
  },
  readiness_score: {
    metric: "readiness_score",
    category: "recovery",
    preferredSources: ["oura"],
    inherentReliability: "high",
    higherIsBetter: true,
  },
  // Oura overnight HRV is recovery HRV; Apple's all-day HRV is a different signal.
  hrv: {
    metric: "hrv",
    category: "recovery",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "high",
    higherIsBetter: true,
    doNotAverage: true,
    unit: "ms",
    disagreement: { pct: 20 },
  },
  resting_hr: {
    metric: "resting_hr",
    category: "recovery",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "high",
    higherIsBetter: false,
    unit: "bpm",
    disagreement: { abs: 8 },
  },
  body_temperature_delta: {
    metric: "body_temperature_delta",
    category: "vitals",
    preferredSources: ["oura"],
    inherentReliability: "medium",
    trendOnly: true,
    unit: "°C",
  },
  respiratory_rate: {
    metric: "respiratory_rate",
    category: "vitals",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    trendOnly: true,
    unit: "br/min",
    disagreement: { abs: 2 },
  },
  spo2_avg: {
    metric: "spo2_avg",
    category: "vitals",
    preferredSources: OURA_RECOVERY,
    inherentReliability: "medium",
    trendOnly: true,
    unit: "%",
    disagreement: { abs: 2 },
  },

  // ── Activity — Apple Watch primary ─────────────────────────────────────────
  steps: {
    metric: "steps",
    category: "activity",
    preferredSources: APPLE_ACTIVITY,
    inherentReliability: "high",
    higherIsBetter: true,
    disagreement: { pct: 20 },
  },
  distance_m: {
    metric: "distance_m",
    category: "activity",
    preferredSources: APPLE_ACTIVITY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "m",
    disagreement: { pct: 25 },
  },
  // Energy burned is a rough model on every wearable — never high confidence.
  active_calories: {
    metric: "active_calories",
    category: "activity",
    preferredSources: APPLE_ACTIVITY,
    inherentReliability: "low",
    neverHighConfidence: true,
    higherIsBetter: true,
    unit: "kcal",
    disagreement: { pct: 30 },
  },
  exercise_minutes: {
    metric: "exercise_minutes",
    category: "activity",
    preferredSources: APPLE_ACTIVITY,
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "min",
    disagreement: { pct: 30 },
  },
  stand_hours: {
    metric: "stand_hours",
    category: "activity",
    preferredSources: ["apple_watch", "apple_health"],
    inherentReliability: "medium",
    higherIsBetter: true,
    unit: "h",
  },
  workouts: {
    metric: "workouts",
    category: "activity",
    preferredSources: APPLE_ACTIVITY,
    inherentReliability: "high",
    higherIsBetter: true,
  },

  // ── Body ───────────────────────────────────────────────────────────────────
  weight_kg: {
    metric: "weight_kg",
    category: "body",
    preferredSources: ["manual", "apple_health", "apple_watch"],
    inherentReliability: "high",
    unit: "kg",
  },
  body_fat_pct: {
    metric: "body_fat_pct",
    category: "body",
    preferredSources: ["manual", "apple_health"],
    inherentReliability: "low",
    neverHighConfidence: true,
    unit: "%",
  },
  vo2max: {
    metric: "vo2max",
    category: "body",
    preferredSources: ["apple_watch", "apple_health"],
    inherentReliability: "medium",
    trendOnly: true,
    higherIsBetter: true,
    unit: "ml/kg/min",
  },

  // ── Subjective self-reports — manual is the only and authoritative source ───
  mood: {
    metric: "mood",
    category: "subjective",
    preferredSources: MANUAL_ONLY,
    inherentReliability: "high",
    higherIsBetter: true,
  },
  energy: {
    metric: "energy",
    category: "subjective",
    preferredSources: MANUAL_ONLY,
    inherentReliability: "high",
    higherIsBetter: true,
  },
  stress: {
    metric: "stress",
    category: "subjective",
    preferredSources: MANUAL_ONLY,
    inherentReliability: "high",
    higherIsBetter: false,
  },
  soreness: {
    metric: "soreness",
    category: "subjective",
    preferredSources: MANUAL_ONLY,
    inherentReliability: "high",
    higherIsBetter: false,
  },
};

export function policyFor(metric: HealthMetricName): MetricPolicy {
  return POLICIES[metric];
}

export const ALL_POLICIES: MetricPolicy[] = Object.values(POLICIES);

export const ALL_METRICS: HealthMetricName[] = Object.keys(POLICIES) as HealthMetricName[];

/** Pick the primary source present in `available`, following the policy order. */
export function pickPrimarySource(
  metric: HealthMetricName,
  available: Iterable<HealthSource>
): HealthSource | null {
  const present = new Set(available);
  for (const src of policyFor(metric).preferredSources) {
    if (present.has(src)) return src;
  }
  // Fall back to any present source so a single unexpected source still surfaces.
  for (const src of present) return src;
  return null;
}
