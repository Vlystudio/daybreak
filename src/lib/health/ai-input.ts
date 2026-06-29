import type {
  Confidence,
  HealthMetricName,
  HealthUnderstandingResult,
  InsightType,
  InsightSeverity,
} from "./types";
import { latestSignals } from "./fusion";

/**
 * Shapes the deterministic understanding into the COMPACT, already-fused payload
 * the AI is allowed to see. The AI never receives raw multi-source rows — only
 * cleaned daily signals, confidence, baseline comparisons, and conflicts — so it
 * explains findings rather than re-deriving (or inventing) them.
 */

export interface FusedHealthAiInput {
  dateRange: { from: string; to: string };
  statuses: { recovery: string; sleep: string; activity: string; stress: string };
  overallConfidence: Confidence;
  connectedSources: string[];
  missingSources: string[];
  deterministicInsights: {
    type: InsightType;
    severity: InsightSeverity;
    title: string;
    message: string;
    confidence: Confidence;
  }[];
  keySignals: {
    metric: HealthMetricName;
    value: number | string | null;
    unit?: string;
    primarySource: string;
    confidence: Confidence;
    vsBaselinePct: number | null;
  }[];
  baselines: {
    metric: HealthMetricName;
    recent7: number | null;
    baseline30: number | null;
    days: number;
    confidence: Confidence;
  }[];
  sourceConflicts: { metric: HealthMetricName; severity: string; message: string }[];
}

const KEY_METRICS: HealthMetricName[] = [
  "readiness_score",
  "sleep_score",
  "sleep_duration_min",
  "sleep_efficiency",
  "hrv",
  "resting_hr",
  "body_temperature_delta",
  "respiratory_rate",
  "spo2_avg",
  "steps",
  "active_calories",
  "exercise_minutes",
  "workouts",
  "mood",
  "energy",
  "stress",
];

export function buildAiHealthInput(result: HealthUnderstandingResult): FusedHealthAiInput {
  const latest = latestSignals(result.dailySignals);
  const baselineByMetric = new Map(result.baselines.map((b) => [b.metric, b]));

  const keySignals: FusedHealthAiInput["keySignals"] = [];
  for (const metric of KEY_METRICS) {
    const s = latest.get(metric);
    if (!s || s.value == null) continue;
    keySignals.push({
      metric,
      value: s.value,
      unit: s.unit,
      primarySource: s.primarySource,
      confidence: s.confidence,
      vsBaselinePct: s.baselineComparison?.percentDifference ?? null,
    });
  }

  return {
    dateRange: result.dateRange,
    statuses: {
      recovery: result.summary.recoveryStatus,
      sleep: result.summary.sleepStatus,
      activity: result.summary.activityStatus,
      stress: result.summary.stressStatus,
    },
    overallConfidence: result.dataQuality.overallConfidence,
    connectedSources: result.dataQuality.connectedSources,
    missingSources: result.dataQuality.missingSources,
    deterministicInsights: result.insights.map((i) => ({
      type: i.type,
      severity: i.severity,
      title: i.title,
      message: i.message,
      confidence: i.confidence,
    })),
    keySignals,
    baselines: KEY_METRICS.map((metric) => baselineByMetric.get(metric))
      .filter((b): b is NonNullable<typeof b> => b != null && b.sampleCount > 0)
      .map((b) => ({
        metric: b.metric,
        recent7: b.short,
        baseline30: b.baseline,
        days: b.sampleCount,
        confidence: b.confidence,
      })),
    sourceConflicts: result.sourceConflicts.map((c) => ({
      metric: c.metric,
      severity: c.severity,
      message: c.message,
    })),
  };
}
