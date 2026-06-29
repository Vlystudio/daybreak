import type {
  DailyHealthSignal,
  HealthBaseline,
  HealthMetricName,
  HealthSource,
  RawHealthObservation,
} from "./types";
import { pickPrimarySource, policyFor } from "./source-policies";
import { computeDisagreement, scoreConfidence } from "./confidence";
import { compareToBaseline } from "./baselines";

/**
 * Source selection (NOT numeric blending). For each metric on each day we keep
 * every source's value as provenance, pick the policy's primary source, take
 * THAT source's value verbatim (we never average across trackers — see HRV),
 * then attach confidence, disagreement, coverage and a baseline comparison.
 */

function toNum(v: number | string | null | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export interface FuseOptions {
  baselines?: Map<HealthMetricName, HealthBaseline>;
  connectedSources?: HealthSource[];
}

function key(date: string, metric: HealthMetricName): string {
  return `${date}|${metric}`;
}

export function fuseDailySignals(
  observations: RawHealthObservation[],
  opts: FuseOptions = {}
): DailyHealthSignal[] {
  const connected = new Set(opts.connectedSources ?? []);

  // Group observations by (date, metric). Last write per source wins.
  const groups = new Map<
    string,
    { date: string; metric: HealthMetricName; bySource: Map<HealthSource, RawHealthObservation> }
  >();
  for (const obs of observations) {
    const k = key(obs.date, obs.metric);
    let g = groups.get(k);
    if (!g) {
      g = { date: obs.date, metric: obs.metric, bySource: new Map() };
      groups.set(k, g);
    }
    g.bySource.set(obs.source, obs);
  }

  const signals: DailyHealthSignal[] = [];
  for (const { date, metric, bySource } of groups.values()) {
    const policy = policyFor(metric);

    const sourceValues: Record<string, number | string | null> = {};
    const numericSources: HealthSource[] = [];
    const numericValues: number[] = [];
    let userId = "";
    for (const [source, obs] of bySource) {
      sourceValues[source] = obs.value;
      userId ||= obs.userId;
      const n = toNum(obs.value);
      if (n != null) {
        numericSources.push(source);
        numericValues.push(n);
      }
    }

    const primarySource = pickPrimarySource(metric, bySource.keys()) ?? "unknown";
    const primaryObs = bySource.get(primarySource as HealthSource);
    const value = primaryObs ? primaryObs.value : null;

    const disagreementScore = computeDisagreement(numericValues, policy);
    const { confidence, confidenceScore, reasons } = scoreConfidence({
      policy,
      primarySource: primarySource as HealthSource,
      numericSources,
      disagreementScore,
    });

    // Coverage = fraction of *connected* relevant sources that reported today.
    const relevant = policy.preferredSources.filter((s) => connected.has(s));
    const present = relevant.filter((s) => bySource.has(s));
    const coverageScore = relevant.length
      ? present.length / relevant.length
      : numericSources.length > 0
        ? 1
        : 0;

    const numericValue = toNum(value);
    const baseline = opts.baselines?.get(metric);
    const baselineComparison =
      numericValue != null ? (compareToBaseline(numericValue, baseline) ?? undefined) : undefined;

    let trendDirection: DailyHealthSignal["trendDirection"] = "unknown";
    if (baselineComparison) {
      const p = baselineComparison.percentDifference;
      trendDirection = Math.abs(p) < 3 ? "stable" : p > 0 ? "up" : "down";
    }

    signals.push({
      userId,
      date,
      metric,
      value,
      unit: policy.unit,
      primarySource: primarySource as HealthSource,
      confidence,
      confidenceScore,
      confidenceReasons: reasons,
      sourceValues,
      disagreementScore: numericSources.length >= 2 ? disagreementScore : undefined,
      coverageScore,
      trendDirection,
      baselineComparison,
    });
  }

  return signals.sort((a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
}

/** Latest signal per metric (most recent date), for "today" summaries. */
export function latestSignals(
  signals: DailyHealthSignal[]
): Map<HealthMetricName, DailyHealthSignal> {
  const out = new Map<HealthMetricName, DailyHealthSignal>();
  for (const s of signals) {
    const cur = out.get(s.metric);
    if (!cur || s.date > cur.date) out.set(s.metric, s);
  }
  return out;
}
