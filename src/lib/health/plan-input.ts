import { latestSignals } from "./fusion";
import { providerLabel } from "./providers";
import type { Confidence, HealthMetricName, HealthUnderstandingResult } from "./types";

/**
 * DailyPlanInputBuilder + ConfidenceScorer, built ON TOP of the existing
 * source-aware understanding layer rather than as a parallel framework. The
 * planner, morning briefing, and dashboard consume this normalized snapshot —
 * they never read Oura-specific (or any single-source) data directly, so a plan
 * works the same whether the user wears an Oura, an Apple Watch, a Fitbit/Pixel,
 * or nothing.
 *
 * Pure (no server-only / DB imports) so it's unit-testable. The async builder
 * that runs the understanding layer lives in `./plan-snapshot`.
 */

export type PlanConfidenceLabel = "High" | "Medium" | "Low";

export type RecommendedPlanMode =
  | "full_health_plan"
  | "partial_health_plan"
  | "manual_checkin_plan"
  | "generic_plan";

export interface PlanHealthMetric {
  metric: HealthMetricName;
  value: number | string | null;
  unit?: string;
  source: string;
  sourceLabel: string;
  confidence: number; // 0..1
}

export interface PlanHealthSnapshot {
  date: string;
  /** The key signals today (best source per metric, with confidence). */
  metrics: PlanHealthMetric[];
  /** Connected sources that can inform the plan, as chips. */
  sources: { id: string; label: string }[];
  confidence: {
    score: number; // 0..100
    label: PlanConfidenceLabel;
    explanation: string;
    reasons: string[];
  };
  recommendedPlanMode: RecommendedPlanMode;
  /** True when a wearable is connected but produced no signal today (≈stale/absent). */
  staleWearable: boolean;
  /** True when a quick manual check-in would meaningfully improve confidence. */
  suggestCheckin: boolean;
}

const KEY_METRICS: HealthMetricName[] = [
  "readiness_score",
  "sleep_score",
  "sleep_duration_min",
  "hrv",
  "resting_hr",
  "steps",
];
const RECOVERY_METRICS: HealthMetricName[] = ["readiness_score", "hrv", "resting_hr"];
const SLEEP_METRICS: HealthMetricName[] = ["sleep_score", "sleep_duration_min"];
const SUBJECTIVE_METRICS: HealthMetricName[] = ["mood", "energy", "stress", "soreness"];

function labelFor(c: Confidence): PlanConfidenceLabel {
  return c === "high" ? "High" : c === "medium" ? "Medium" : "Low";
}

function explanationFor(mode: RecommendedPlanMode): string {
  switch (mode) {
    case "full_health_plan":
      return "Based on recent sleep, recovery, and activity data.";
    case "partial_health_plan":
      return "Some data is missing, so this plan uses partial signals.";
    case "manual_checkin_plan":
      return "No tracker data found. This plan is based on your check-in.";
    default:
      return "No tracker or check-in data yet, so this is a general plan.";
  }
}

/** Build a normalized plan snapshot from an already-computed understanding. */
export function snapshotFromUnderstanding(
  understanding: HealthUnderstandingResult
): PlanHealthSnapshot {
  const latest = latestSignals(understanding.dailySignals);

  const metrics: PlanHealthMetric[] = [];
  for (const metric of KEY_METRICS) {
    const signal = latest.get(metric);
    if (!signal || signal.value == null) continue;
    metrics.push({
      metric,
      value: signal.value,
      unit: signal.unit,
      source: signal.primarySource,
      sourceLabel: providerLabel(signal.primarySource),
      confidence: signal.confidenceScore,
    });
  }

  const present = new Set(metrics.map((m) => m.metric));
  const hasSleep = SLEEP_METRICS.some((m) => present.has(m));
  const hasRecovery = RECOVERY_METRICS.some((m) => present.has(m));
  const hasManualCheckin = SUBJECTIVE_METRICS.some((m) => latest.get(m)?.value != null);

  const connected = understanding.dataQuality.connectedSources;
  const hasWearable = connected.some((s) => s !== "manual");

  let recommendedPlanMode: RecommendedPlanMode;
  if (hasWearable && hasSleep && hasRecovery) recommendedPlanMode = "full_health_plan";
  else if (hasWearable && (hasSleep || hasRecovery)) recommendedPlanMode = "partial_health_plan";
  else if (hasManualCheckin) recommendedPlanMode = "manual_checkin_plan";
  else recommendedPlanMode = "generic_plan";

  // Reasons: positive signals first, then the understanding layer's own warnings.
  const reasons: string[] = [];
  if (hasSleep) reasons.push("Recent sleep data available.");
  if (hasRecovery) reasons.push("Recovery signals present (HRV / resting HR / readiness).");
  if (hasWearable && !hasSleep) reasons.push("No recent sleep data.");
  if (hasWearable && !hasRecovery) reasons.push("Recovery data missing.");
  if (!hasWearable && hasManualCheckin) reasons.push("Using your manual check-in.");
  if (!hasWearable && !hasManualCheckin) reasons.push("No wearable connected and no check-in yet.");
  for (const w of understanding.dataQuality.warnings) reasons.push(w);

  const overall = understanding.dataQuality.overallConfidence;
  const label = labelFor(overall);
  const confScores = metrics.map((m) => m.confidence);
  const score = confScores.length
    ? Math.round((confScores.reduce((a, b) => a + b, 0) / confScores.length) * 100)
    : label === "High"
      ? 80
      : label === "Medium"
        ? 55
        : 25;

  const sources = connected.map((id) => ({ id, label: providerLabel(id) }));

  // If there's no wearable signal today at all, treat wearable data as
  // stale/absent so the plan leans on the check-in.
  const staleWearable = hasWearable && metrics.length === 0;

  return {
    date: understanding.dateRange.to,
    metrics,
    sources,
    confidence: { score, label, explanation: explanationFor(recommendedPlanMode), reasons },
    recommendedPlanMode,
    staleWearable,
    // A check-in helps most when there's no fresh wearable signal or confidence is low.
    suggestCheckin: !hasManualCheckin && (!hasWearable || staleWearable || overall === "low"),
  };
}
