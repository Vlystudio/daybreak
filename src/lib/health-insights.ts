import type { HealthMetric } from "@/lib/types";

/**
 * Deterministic trend + "heads-up" analysis over Oura daily metrics. Pure
 * functions, no AI — instant and free, so they power the always-on flags.
 * Framed as general wellness guidance, never medical advice.
 */

export type MetricKey =
  | "readiness_score"
  | "sleep_score"
  | "hrv_avg"
  | "resting_hr"
  | "sleep_duration_min"
  | "sleep_efficiency"
  | "deep_sleep_min"
  | "rem_sleep_min"
  | "light_sleep_min"
  | "body_temperature_delta";

export interface MetricStat {
  latest: number | null;
  avg7: number | null;
  avg30: number | null;
  deltaPct: number | null; // (avg7 - avg30) / avg30, as a percentage
  direction: "up" | "down" | "flat";
}

export type HeadsUpSeverity = "good" | "watch" | "alert";

export interface HeadsUp {
  id: string;
  severity: HeadsUpSeverity;
  title: string;
  detail: string;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Stats for one metric. `metrics` must be sorted ascending by date. */
export function metricStat(metrics: HealthMetric[], key: MetricKey): MetricStat {
  const series = metrics
    .map((m) => m[key])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const latest = series.length ? series[series.length - 1] : null;
  const avg7 = mean(series.slice(-7));
  const avg30 = mean(series.slice(-30));
  const deltaPct = avg7 != null && avg30 != null && avg30 !== 0 ? ((avg7 - avg30) / avg30) * 100 : null;
  const direction = deltaPct == null ? "flat" : deltaPct > 2 ? "up" : deltaPct < -2 ? "down" : "flat";

  return { latest, avg7, avg30, deltaPct, direction };
}

/** Notable patterns worth surfacing. Order: alerts first, then watches, then good. */
export function computeHeadsUp(metrics: HealthMetric[]): HeadsUp[] {
  const flags: HeadsUp[] = [];
  if (metrics.length < 3) return flags;

  const rhr = metricStat(metrics, "resting_hr");
  const hrv = metricStat(metrics, "hrv_avg");
  const readiness = metricStat(metrics, "readiness_score");
  const sleepDur = metricStat(metrics, "sleep_duration_min");
  const sleepEff = metricStat(metrics, "sleep_efficiency");
  const temp = metricStat(metrics, "body_temperature_delta");

  if (rhr.avg7 != null && rhr.avg30 != null && rhr.avg7 - rhr.avg30 >= 3) {
    const up = rhr.avg7 - rhr.avg30;
    flags.push({
      id: "rhr-up",
      severity: up >= 6 ? "alert" : "watch",
      title: `Resting heart rate is up ~${Math.round(up)} bpm`,
      detail:
        "Your 7-day average sits above your monthly baseline. An elevated resting HR can follow poor sleep, stress, alcohol, or a coming illness — a lighter day and extra rest is wise.",
    });
  }

  if (hrv.deltaPct != null && hrv.deltaPct <= -10) {
    flags.push({
      id: "hrv-down",
      severity: hrv.deltaPct <= -20 ? "alert" : "watch",
      title: `HRV is down ${Math.abs(Math.round(hrv.deltaPct))}% from baseline`,
      detail:
        "Lower heart-rate variability usually means your body is under more strain and recovering less. Prioritize sleep and keep training easy until it rebounds.",
    });
  } else if (hrv.deltaPct != null && hrv.deltaPct >= 10) {
    flags.push({
      id: "hrv-up",
      severity: "good",
      title: `HRV is trending up ${Math.round(hrv.deltaPct)}%`,
      detail: "Your recovery capacity is improving — a good window to push a little harder if you feel like it.",
    });
  }

  if (readiness.latest != null && readiness.latest < 60) {
    flags.push({
      id: "readiness-low",
      severity: readiness.latest < 50 ? "alert" : "watch",
      title: `Readiness is low today (${Math.round(readiness.latest)})`,
      detail: "Your body is signaling it needs recovery. Favor light movement, hydration, and an early night.",
    });
  }

  if (sleepDur.avg7 != null && sleepDur.avg7 < 390) {
    flags.push({
      id: "sleep-short",
      severity: sleepDur.avg7 < 360 ? "alert" : "watch",
      title: `You're averaging ${(sleepDur.avg7 / 60).toFixed(1)}h of sleep`,
      detail:
        "That's below the ~7–9h most adults need. Consistent short sleep chips away at recovery, focus, and mood — try shifting bedtime earlier.",
    });
  }

  if (sleepEff.avg7 != null && sleepEff.avg7 < 85) {
    flags.push({
      id: "sleep-eff",
      severity: "watch",
      title: `Sleep efficiency is ${Math.round(sleepEff.avg7)}%`,
      detail: "You're spending a fair bit of time in bed awake. A calmer wind-down and a cooler, darker room often help.",
    });
  }

  if (temp.latest != null && Math.abs(temp.latest) >= 0.5) {
    flags.push({
      id: "temp",
      severity: Math.abs(temp.latest) >= 0.8 ? "alert" : "watch",
      title: `Body temperature is ${temp.latest > 0 ? "above" : "below"} your baseline`,
      detail:
        "A notable shift in skin temperature can precede illness or reflect your cycle, alcohol, or a warm room. Keep an eye on how you feel.",
    });
  }

  if (readiness.avg7 != null && readiness.avg7 >= 80 && !flags.some((f) => f.severity === "alert")) {
    flags.push({
      id: "readiness-good",
      severity: "good",
      title: "Recovery looks strong this week",
      detail: `Your readiness has averaged ${Math.round(readiness.avg7)} — a great base to build on.`,
    });
  }

  const rank: Record<HeadsUpSeverity, number> = { alert: 0, watch: 1, good: 2 };
  return flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
