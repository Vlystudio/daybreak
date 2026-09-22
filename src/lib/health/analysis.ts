import type {
  ActivityStatus,
  Confidence,
  DailyHealthSignal,
  HealthBaseline,
  HealthInsight,
  HealthMetricName,
  RecoveryStatus,
  SleepStatus,
  SourceConflict,
  StressStatus,
} from "./types";
import { policyFor } from "./source-policies";
import { MIN_DAYS_FOR_BASELINE, MIN_DAYS_FOR_TREND } from "./baselines";

/**
 * Deterministic, source-aware analysis: source conflicts, personal-baseline
 * insights, and at-a-glance statuses. Runs BEFORE any AI. Language is
 * intentionally cautious — "suggests", "may indicate", "compared to your
 * baseline", "lower confidence" — and never diagnoses.
 */

const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/** The most cautious confidence among inputs (chain is only as strong as its weakest link). */
function lowest(...cs: Confidence[]): Confidence {
  return cs.reduce((a, b) => (CONF_RANK[b] < CONF_RANK[a] ? b : a), "high" as Confidence);
}

function num(v: number | string | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ── Source conflicts ─────────────────────────────────────────────────────────

function severityFor(score: number): SourceConflict["severity"] {
  if (score >= 0.85) return "major";
  if (score >= 0.65) return "moderate";
  return "minor";
}

export function detectSourceConflicts(signals: DailyHealthSignal[]): SourceConflict[] {
  const conflicts: SourceConflict[] = [];
  for (const s of signals) {
    if (s.disagreementScore == null || s.disagreementScore < 0.5) continue; // at/above the metric threshold
    const policy = policyFor(s.metric);
    const entries = Object.entries(s.sourceValues).filter(([, v]) => num(v) != null);
    if (entries.length < 2) continue;

    const sources: SourceConflict["sources"] = {};
    for (const [src, v] of entries) sources[src as keyof typeof sources] = v;
    const valuesStr = entries
      .map(([src, v]) => `${src} ${num(v)}${policy.unit ?? ""}`)
      .join(" vs ");

    let note = "";
    if (policy.doNotAverage)
      note =
        " HRV from different windows isn't directly comparable — Oura's is overnight recovery HRV.";
    else if (policy.neverHighConfidence)
      note = " Energy burned is a rough estimate on every wearable.";

    conflicts.push({
      date: s.date,
      metric: s.metric,
      sources,
      severity: severityFor(s.disagreementScore),
      message: `${s.metric.replace(/_/g, " ")}: ${valuesStr}.${note} Daybreak uses ${s.primarySource} for this metric.`,
      recommendedPrimarySource: s.primarySource,
    });
  }
  return conflicts;
}

// ── Insights ─────────────────────────────────────────────────────────────────

interface Ctx {
  latest: Map<HealthMetricName, DailyHealthSignal>;
  baselines: Map<HealthMetricName, HealthBaseline>;
}

function baselineOf(ctx: Ctx, metric: HealthMetricName): HealthBaseline | undefined {
  return ctx.baselines.get(metric);
}

/** Enough history for a baseline-comparison claim about this metric? */
function trendReady(ctx: Ctx, metric: HealthMetricName): boolean {
  return (baselineOf(ctx, metric)?.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND;
}

function baselineConfidence(ctx: Ctx, ...metrics: HealthMetricName[]): Confidence {
  let worst: Confidence = "high";
  for (const m of metrics) worst = lowest(worst, baselineOf(ctx, m)?.confidence ?? "low");
  return worst;
}

function pct(signal: DailyHealthSignal | undefined): number | null {
  return signal?.baselineComparison?.percentDifference ?? null;
}

export function generateInsights(ctx: Ctx): HealthInsight[] {
  const out: HealthInsight[] = [];
  const { latest } = ctx;

  // Recovery: resting HR up + HRV down vs baseline.
  const rhr = latest.get("resting_hr");
  const hrv = latest.get("hrv");
  if (rhr && hrv && trendReady(ctx, "resting_hr") && trendReady(ctx, "hrv")) {
    const rhrPct = pct(rhr);
    const hrvPct = pct(hrv);
    if (rhrPct != null && hrvPct != null && rhrPct >= 5 && hrvPct <= -8) {
      const conf = lowest(
        rhr.confidence,
        hrv.confidence,
        baselineConfidence(ctx, "resting_hr", "hrv")
      );
      out.push({
        type: "recovery",
        severity: "watch",
        title: "Recovery may be dipping",
        message: `Your resting heart rate is ${Math.round(rhrPct)}% above your ${rhr.baselineComparison?.baselineWindowDays}-day baseline while HRV is ${Math.abs(Math.round(hrvPct))}% below your usual range. This pattern can reflect sleep, strain, stress, alcohol, or normal variation — it may be worth an easier day if that matches how you feel.`,
        confidence: conf,
        reasons: [
          `resting HR +${Math.round(rhrPct)}% vs baseline`,
          `HRV ${Math.round(hrvPct)}% vs baseline`,
        ],
        relatedMetrics: ["resting_hr", "hrv"],
        sourceNotes:
          rhr.disagreementScore != null || hrv.disagreementScore != null
            ? ["Confidence is lower because your trackers didn't fully agree today."]
            : undefined,
      });
    } else if (rhrPct != null && hrvPct != null && rhrPct <= -3 && hrvPct >= 5) {
      out.push({
        type: "recovery",
        severity: "positive",
        title: "Recovery looks strong",
        message: `Resting heart rate is below and HRV above your baseline — your body suggests it's recovering well. A good window to train a little harder if you feel up to it.`,
        confidence: lowest(rhr.confidence, hrv.confidence),
        reasons: ["resting HR below baseline", "HRV above baseline"],
        relatedMetrics: ["resting_hr", "hrv"],
      });
    }
  }

  // Readiness, when present (Oura), is a strong recovery summary.
  const readiness = latest.get("readiness_score");
  const rv = num(readiness?.value);
  if (readiness && rv != null && rv < 65) {
    out.push({
      type: "recovery",
      severity: rv < 55 ? "warning" : "watch",
      title: `Readiness is low today (${Math.round(rv)})`,
      message:
        "Your wearable suggests your body wants recovery. Compared with a typical day, lighter movement, hydration, and an earlier night may help.",
      confidence: readiness.confidence,
      reasons: [`readiness ${Math.round(rv)}`],
      relatedMetrics: ["readiness_score"],
    });
  }

  // Sleep: short average.
  const sleep = ctx.baselines.get("sleep_duration_min");
  if (sleep?.short != null && (sleep.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND && sleep.short < 390) {
    out.push({
      type: "sleep",
      severity: sleep.short < 360 ? "warning" : "watch",
      title: `You're averaging ${(sleep.short / 60).toFixed(1)}h of sleep`,
      message:
        "That's below the ~7–9h most adults need. Consistently short sleep tends to chip away at recovery, focus, and mood — shifting bedtime earlier may help.",
      confidence: lowest(
        latest.get("sleep_duration_min")?.confidence ?? "medium",
        sleep.confidence
      ),
      reasons: [`7-day sleep avg ${(sleep.short / 60).toFixed(1)}h`],
      relatedMetrics: ["sleep_duration_min"],
    });
  }

  // Activity: low steps.
  const steps = ctx.baselines.get("steps");
  if (
    steps?.short != null &&
    (steps.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND &&
    steps.short < 5000
  ) {
    out.push({
      type: "activity",
      severity: "watch",
      title: `Averaging ${Math.round(steps.short).toLocaleString()} steps a day`,
      message:
        "That's on the sedentary side. Even a couple of short walks would lift your daily activity, which often helps sleep and mood.",
      confidence: lowest(latest.get("steps")?.confidence ?? "high", steps.confidence),
      reasons: [`7-day steps avg ${Math.round(steps.short).toLocaleString()}`],
      relatedMetrics: ["steps"],
    });
  }

  // Vitals: skin-temperature shift (trend/watchlist only).
  const temp = latest.get("body_temperature_delta");
  const tv = num(temp?.value);
  if (temp && tv != null && Math.abs(tv) >= 0.5) {
    out.push({
      type: "vitals",
      severity: Math.abs(tv) >= 0.8 ? "warning" : "watch",
      title: `Skin temperature is ${tv > 0 ? "above" : "below"} your baseline`,
      message:
        "A notable shift can reflect your cycle, alcohol, room temperature, measurement variation, or other factors. This is wellness trend data, not a diagnosis — keep an eye on how you feel.",
      confidence: temp.confidence,
      reasons: [`temperature deviation ${tv > 0 ? "+" : ""}${tv}°C`],
      relatedMetrics: ["body_temperature_delta"],
    });
  }

  // Vitals: overnight SpO₂.
  const spo2 = ctx.baselines.get("spo2_avg");
  if (spo2?.short != null && (spo2.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND && spo2.short < 95) {
    out.push({
      type: "vitals",
      severity: spo2.short < 93 ? "warning" : "watch",
      title: `Overnight blood oxygen averaging ${Math.round(spo2.short)}%`,
      message:
        "Healthy nights usually sit at 95%+. Dips may come from congestion, alcohol, or altitude. This is trend data — worth watching, and worth mentioning to a doctor if it persists.",
      confidence: lowest(latest.get("spo2_avg")?.confidence ?? "medium", spo2.confidence),
      reasons: [`7-day SpO₂ avg ${Math.round(spo2.short)}%`],
      relatedMetrics: ["spo2_avg"],
    });
  }

  // Stress: subjective stress trending high.
  const stress = ctx.baselines.get("stress");
  if (
    stress?.short != null &&
    (stress.sampleCount ?? 0) >= MIN_DAYS_FOR_TREND &&
    stress.short >= 3.5
  ) {
    out.push({
      type: "stress",
      severity: "watch",
      title: "Your stress self-reports are running high",
      message:
        "Compared with your usual, recent days have felt more stressful. If this lines up with lower HRV or readiness, building in a few real recovery breaks may help.",
      confidence: "high", // self-report is authoritative for how you feel
      reasons: [`7-day stress self-report avg ${stress.short.toFixed(1)}/5`],
      relatedMetrics: ["stress"],
    });
  }

  return out;
}

/** A neutral data-quality insight when there isn't enough history yet. */
export function dataQualityInsights(
  baselines: Map<HealthMetricName, HealthBaseline>,
  conflicts: SourceConflict[]
): HealthInsight[] {
  const out: HealthInsight[] = [];
  const maxSamples = Math.max(0, ...[...baselines.values()].map((b) => b.sampleCount));
  if (maxSamples < MIN_DAYS_FOR_TREND) {
    out.push({
      type: "data_quality",
      severity: "neutral",
      title: "Still learning your baseline",
      message: `Daybreak has about ${maxSamples} day${maxSamples === 1 ? "" : "s"} of data. It needs ~2 weeks before it can make confident, personalized trend comparisons. Keep syncing — accuracy improves over time.`,
      confidence: "high",
      reasons: [`${maxSamples} days of history`],
      relatedMetrics: [],
    });
  } else if (maxSamples < MIN_DAYS_FOR_BASELINE) {
    out.push({
      type: "data_quality",
      severity: "neutral",
      title: "Baseline is forming",
      message: `With ~${maxSamples} days of data, baseline comparisons are early-stage and lower confidence. They get stronger past 30 days.`,
      confidence: "medium",
      reasons: [`${maxSamples} days of history`],
      relatedMetrics: [],
    });
  }

  const major = conflicts.filter((c) => c.severity !== "minor");
  if (major.length > 0) {
    const metrics = [...new Set(major.map((c) => c.metric.replace(/_/g, " ")))]
      .slice(0, 3)
      .join(", ");
    out.push({
      type: "data_quality",
      severity: "watch",
      title: "Your trackers disagree on some metrics",
      message: `Oura and Apple Health reported noticeably different values for ${metrics}. Daybreak uses the best source per metric, but lower-confidence numbers are flagged in Sources.`,
      confidence: "high",
      reasons: major.slice(0, 3).map((c) => c.message),
      relatedMetrics: major.map((c) => c.metric),
    });
  }
  return out;
}

// ── Statuses ─────────────────────────────────────────────────────────────────

export function summarizeStatuses(ctx: Ctx): {
  recoveryStatus: RecoveryStatus;
  sleepStatus: SleepStatus;
  activityStatus: ActivityStatus;
  stressStatus: StressStatus;
} {
  const { latest, baselines } = ctx;

  // Recovery: prefer readiness, else HRV/RHR vs baseline.
  let recoveryStatus: RecoveryStatus = "unknown";
  const rv = num(latest.get("readiness_score")?.value);
  if (rv != null)
    recoveryStatus = rv >= 80 ? "strong" : rv >= 70 ? "normal" : rv >= 60 ? "watch" : "low";
  else {
    const hrvPct = pct(latest.get("hrv"));
    const rhrPct = pct(latest.get("resting_hr"));
    if (hrvPct != null || rhrPct != null) {
      const bad = (hrvPct ?? 0) <= -8 || (rhrPct ?? 0) >= 6;
      const good = (hrvPct ?? 0) >= 6 && (rhrPct ?? 0) <= 0;
      recoveryStatus = bad ? "watch" : good ? "strong" : "normal";
    }
  }

  // Sleep: prefer sleep score, else duration short window.
  let sleepStatus: SleepStatus = "unknown";
  const ss = num(latest.get("sleep_score")?.value);
  const sleepShort = baselines.get("sleep_duration_min")?.short ?? null;
  if (ss != null)
    sleepStatus = ss >= 80 ? "strong" : ss >= 70 ? "normal" : ss >= 60 ? "watch" : "low";
  else if (sleepShort != null)
    sleepStatus =
      sleepShort >= 450
        ? "strong"
        : sleepShort >= 390
          ? "normal"
          : sleepShort >= 360
            ? "watch"
            : "low";

  // Activity: steps short window vs simple thresholds.
  let activityStatus: ActivityStatus = "unknown";
  const stepsShort = baselines.get("steps")?.short ?? null;
  if (stepsShort != null)
    activityStatus = stepsShort >= 10000 ? "high" : stepsShort >= 6000 ? "normal" : "low";

  // Stress: subjective short window, else high-stress minutes.
  let stressStatus: StressStatus = "unknown";
  const stressShort = baselines.get("stress")?.short ?? null;
  if (stressShort != null)
    stressStatus = stressShort >= 3.5 ? "high" : stressShort <= 2 ? "low" : "normal";

  return { recoveryStatus, sleepStatus, activityStatus, stressStatus };
}
