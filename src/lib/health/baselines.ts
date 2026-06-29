import type { Confidence, HealthBaseline, HealthMetricName } from "./types";

/**
 * Personal baselines from rolling windows. Everything is relative to the user's
 * own history — we never compare to population norms. Baseline confidence grows
 * with history length so we don't make strong claims from a few days of data.
 */

export const SHORT_WINDOW = 7;
export const BASELINE_WINDOW = 30;
export const LONG_WINDOW = 90;

/** Minimum days of history before a metric supports trend/baseline claims. */
export const MIN_DAYS_FOR_TREND = 14;
export const MIN_DAYS_FOR_BASELINE = 30;

export interface DatedValue {
  date: string; // YYYY-MM-DD
  value: number;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

/** History-length → baseline confidence (see spec's tiers). */
export function baselineConfidence(sampleCount: number): Confidence {
  if (sampleCount >= 60) return "high";
  if (sampleCount >= MIN_DAYS_FOR_BASELINE) return "medium";
  return "low"; // < 30 days: not enough for a strong baseline
}

/**
 * Build a baseline from a metric's chronological values. `series` should be
 * ascending by date; the most recent values anchor the short window.
 */
export function buildBaseline(metric: HealthMetricName, series: DatedValue[]): HealthBaseline {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((s) => s.value).filter((v) => Number.isFinite(v));

  return {
    metric,
    short: round(mean(values.slice(-SHORT_WINDOW))),
    baseline: round(mean(values.slice(-BASELINE_WINDOW))),
    long: round(mean(values.slice(-LONG_WINDOW))),
    shortWindowDays: SHORT_WINDOW,
    baselineWindowDays: BASELINE_WINDOW,
    longWindowDays: LONG_WINDOW,
    sampleCount: values.length,
    confidence: baselineConfidence(values.length),
  };
}

/** Build baselines for many metrics from a map of metric → series. */
export function buildBaselines(
  seriesByMetric: Map<HealthMetricName, DatedValue[]>
): HealthBaseline[] {
  const out: HealthBaseline[] = [];
  for (const [metric, series] of seriesByMetric) out.push(buildBaseline(metric, series));
  return out;
}

export interface BaselineComparisonResult {
  baselineValue: number;
  absoluteDifference: number;
  percentDifference: number;
  baselineWindowDays: number;
}

/** Compare a value to a baseline; null when no baseline or a zero baseline. */
export function compareToBaseline(
  value: number,
  baseline: HealthBaseline | undefined
): BaselineComparisonResult | null {
  const base = baseline?.baseline;
  if (baseline == null || base == null) return null;
  const abs = Math.round((value - base) * 100) / 100;
  const pct = base !== 0 ? Math.round(((value - base) / Math.abs(base)) * 1000) / 10 : 0;
  return {
    baselineValue: base,
    absoluteDifference: abs,
    percentDifference: pct,
    baselineWindowDays: baseline.baselineWindowDays,
  };
}

/** Whether a metric has enough history to support a trend claim. */
export function hasEnoughForTrend(baseline: HealthBaseline | undefined): boolean {
  return (baseline?.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND;
}
