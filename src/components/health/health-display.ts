import type {
  ActivityStatus,
  Confidence,
  DailyHealthSignal,
  HealthMetricName,
  RecoveryStatus,
  StressStatus,
} from "@/lib/health/types";
import type { TrendPoint } from "@/components/health/trend-chart";
import { format, parseISO } from "date-fns";

/**
 * Shared, presentation-only config for the Health command center: how each
 * status, confidence level, and metric is labelled and charted. Pure data so
 * Overview / Trends / Sources stay consistent and free of duplicated mappings.
 */

type BadgeVariant = "sage" | "honey" | "sky" | "outline" | "destructive";

export const CONFIDENCE_DISPLAY: Record<Confidence, { label: string; variant: BadgeVariant }> = {
  high: { label: "High confidence", variant: "sage" },
  medium: { label: "Medium confidence", variant: "honey" },
  low: { label: "Low confidence", variant: "outline" },
};

export const RECOVERY_DISPLAY: Record<RecoveryStatus, { label: string; variant: BadgeVariant }> = {
  strong: { label: "Strong", variant: "sage" },
  normal: { label: "Normal", variant: "sky" },
  watch: { label: "Worth watching", variant: "honey" },
  low: { label: "Low", variant: "destructive" },
  unknown: { label: "No data yet", variant: "outline" },
};

export const ACTIVITY_DISPLAY: Record<ActivityStatus, { label: string; variant: BadgeVariant }> = {
  high: { label: "High", variant: "sage" },
  normal: { label: "Normal", variant: "sky" },
  low: { label: "Low", variant: "honey" },
  unknown: { label: "No data yet", variant: "outline" },
};

export const STRESS_DISPLAY: Record<StressStatus, { label: string; variant: BadgeVariant }> = {
  high: { label: "Elevated", variant: "honey" },
  normal: { label: "Normal", variant: "sky" },
  low: { label: "Calm", variant: "sage" },
  unknown: { label: "No data yet", variant: "outline" },
};

export interface MetricDisplay {
  label: string;
  color: string; // CSS var
  unit?: string;
  /** Convert the stored value for display (e.g. sleep minutes → hours). */
  transform?: (n: number) => number;
  format?: (n: number) => string;
}

export const METRIC_DISPLAY: Partial<Record<HealthMetricName, MetricDisplay>> = {
  readiness_score: { label: "Readiness", color: "var(--primary)" },
  hrv: { label: "HRV", color: "var(--sage)", unit: "ms" },
  resting_hr: { label: "Resting HR", color: "var(--peach)", unit: "bpm" },
  body_temperature_delta: {
    label: "Body temperature",
    color: "var(--honey)",
    unit: "°C",
    format: (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1)),
  },
  sleep_duration_min: {
    label: "Sleep",
    color: "var(--sky)",
    unit: "h",
    transform: (n) => n / 60,
    format: (n) => n.toFixed(1),
  },
  sleep_efficiency: { label: "Sleep efficiency", color: "var(--sage)", unit: "%" },
  sleep_score: { label: "Sleep score", color: "var(--sky)" },
  respiratory_rate: {
    label: "Respiratory rate",
    color: "var(--sage)",
    unit: "/min",
    format: (n) => n.toFixed(1),
  },
  spo2_avg: { label: "Blood oxygen", color: "var(--sky)", unit: "%", format: (n) => n.toFixed(1) },
  steps: { label: "Steps", color: "var(--primary)", format: (n) => Math.round(n).toLocaleString() },
  distance_m: {
    label: "Distance",
    color: "var(--sage)",
    unit: "km",
    transform: (n) => n / 1000,
    format: (n) => n.toFixed(1),
  },
  exercise_minutes: { label: "Exercise", color: "var(--sage)", unit: "min" },
  active_calories: { label: "Active calories (est.)", color: "var(--peach)", unit: "cal" },
  workouts: { label: "Workouts", color: "var(--primary)" },
  mood: { label: "Mood", color: "var(--primary)", format: (n) => n.toFixed(1) },
  energy: { label: "Energy", color: "var(--sage)", format: (n) => n.toFixed(1) },
  stress: { label: "Stress", color: "var(--peach)", format: (n) => n.toFixed(1) },
  soreness: { label: "Soreness", color: "var(--honey)", format: (n) => n.toFixed(1) },
};

export function metricLabel(metric: HealthMetricName): string {
  return METRIC_DISPLAY[metric]?.label ?? metric.replace(/_/g, " ");
}

export type TrendGroup = "Recovery" | "Sleep" | "Activity" | "Vitals" | "Stress";

export const TREND_GROUPS: { group: TrendGroup; metrics: HealthMetricName[] }[] = [
  {
    group: "Recovery",
    metrics: ["readiness_score", "hrv", "resting_hr", "body_temperature_delta"],
  },
  {
    group: "Sleep",
    metrics: ["sleep_duration_min", "sleep_efficiency", "sleep_score", "respiratory_rate"],
  },
  { group: "Activity", metrics: ["steps", "workouts", "exercise_minutes", "active_calories"] },
  {
    group: "Vitals",
    metrics: ["resting_hr", "respiratory_rate", "spo2_avg", "body_temperature_delta"],
  },
  { group: "Stress", metrics: ["stress", "mood", "energy", "soreness"] },
];

/** Build a chart series (with display transform applied) for one metric. */
export function metricSeries(signals: DailyHealthSignal[], metric: HealthMetricName): TrendPoint[] {
  const tf = METRIC_DISPLAY[metric]?.transform ?? ((n: number) => n);
  return signals
    .filter((s) => s.metric === metric && typeof s.value === "number" && Number.isFinite(s.value))
    .map((s) => ({ day: format(parseISO(s.date), "MMM d"), value: tf(s.value as number) }));
}
