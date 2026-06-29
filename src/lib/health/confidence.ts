import type { Confidence, HealthSource } from "./types";
import { type MetricPolicy } from "./source-policies";

/**
 * Deterministic confidence scoring for a fused metric. Confidence reflects how
 * much to trust the chosen value, based on: the metric's inherent reliability,
 * whether its preferred source is present, whether multiple trackers agree, and
 * metric-specific caps (calories are never high; HRV sources aren't comparable).
 */

const RELIABILITY_BASE: Record<MetricPolicy["inherentReliability"], number> = {
  high: 0.85,
  medium: 0.65,
  low: 0.45,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function meanAbs(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
}

/**
 * 0..1 disagreement between numeric source values, scaled so that a spread equal
 * to the metric's threshold scores ~0.5 and ≥2× the threshold scores 1.0.
 */
export function computeDisagreement(values: number[], policy: MetricPolicy): number {
  if (values.length < 2) return 0;
  const spread = Math.max(...values) - Math.min(...values);
  const base = meanAbs(values);
  const ratios: number[] = [];
  if (policy.disagreement?.abs) ratios.push(spread / policy.disagreement.abs);
  if (policy.disagreement?.pct && base > 0)
    ratios.push(spread / base / (policy.disagreement.pct / 100));
  if (ratios.length === 0 && base > 0) ratios.push(spread / base / 0.15); // generic 15% fallback
  const r = ratios.length ? Math.max(...ratios) : 0;
  return clamp01(r / 2);
}

export function confidenceLabel(score: number): Confidence {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export interface ConfidenceInput {
  policy: MetricPolicy;
  primarySource: HealthSource;
  /** Sources that contributed a finite numeric value. */
  numericSources: HealthSource[];
  disagreementScore: number;
}

export interface ConfidenceResult {
  confidence: Confidence;
  confidenceScore: number;
  reasons: string[];
}

export function scoreConfidence(input: ConfidenceInput): ConfidenceResult {
  const { policy, primarySource, numericSources, disagreementScore } = input;
  const reasons: string[] = [];
  let score = RELIABILITY_BASE[policy.inherentReliability];

  // Preferred source present, or a fallback?
  const usingTopChoice = primarySource === policy.preferredSources[0];
  if (usingTopChoice) {
    reasons.push(`${primarySource} is the preferred source for this metric`);
  } else {
    score -= 0.18;
    reasons.push(
      `${policy.preferredSources[0]} unavailable — using ${primarySource} as a fallback`
    );
  }

  // Cross-source agreement.
  if (numericSources.length >= 2) {
    if (policy.doNotAverage) {
      reasons.push("sources measure different windows — kept separate, not averaged");
      if (disagreementScore >= 0.5) score -= 0.05;
    } else if (disagreementScore >= 0.5) {
      score -= 0.2;
      reasons.push("your trackers disagreed today — confidence reduced");
    } else if (disagreementScore <= 0.15) {
      score += 0.1;
      reasons.push("multiple trackers agree");
    } else {
      score -= 0.05;
      reasons.push("trackers differ slightly");
    }
  }

  // Metric-specific caps.
  if (policy.neverHighConfidence) {
    score = Math.min(score, 0.55);
    reasons.push("this is an estimate — treat it as a rough trend, not an exact number");
  }
  if (policy.trendOnly) {
    score = Math.min(score, 0.68);
    reasons.push("best read as a trend or watchlist item, not a precise value");
  }

  score = clamp01(Math.round(score * 100) / 100);
  return { confidence: confidenceLabel(score), confidenceScore: score, reasons };
}
