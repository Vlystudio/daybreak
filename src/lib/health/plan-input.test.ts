import { describe, it, expect } from "vitest";
import { snapshotFromUnderstanding } from "./plan-input";
import { HEALTH_PROVIDERS, isProviderEnabled, providerInfo, providerState } from "./providers";
import type {
  Confidence,
  DailyHealthSignal,
  HealthMetricName,
  HealthSource,
  HealthUnderstandingResult,
} from "./types";

function sig(
  metric: HealthMetricName,
  source: HealthSource,
  value: number,
  confidenceScore = 0.8,
  date = "2026-06-26"
): DailyHealthSignal {
  return {
    userId: "u1",
    date,
    metric,
    value,
    primarySource: source,
    confidence: confidenceScore >= 0.75 ? "high" : confidenceScore >= 0.5 ? "medium" : "low",
    confidenceScore,
    confidenceReasons: [],
    sourceValues: { [source]: value },
  };
}

function understanding(opts: {
  signals: DailyHealthSignal[];
  connectedSources: string[];
  overallConfidence: Confidence;
  warnings?: string[];
}): HealthUnderstandingResult {
  return {
    dateRange: { from: "2026-06-12", to: "2026-06-26" },
    dailySignals: opts.signals,
    baselines: [],
    insights: [],
    sourceConflicts: [],
    dataQuality: {
      overallConfidence: opts.overallConfidence,
      connectedSources: opts.connectedSources,
      missingSources: [],
      coverageByMetric: {},
      warnings: opts.warnings ?? [],
    },
    summary: {
      recoveryStatus: "normal",
      sleepStatus: "normal",
      activityStatus: "normal",
      stressStatus: "normal",
      topInsights: [],
    },
  };
}

describe("snapshotFromUnderstanding — Daily Plan health input", () => {
  it("Oura-only with sleep + recovery → full_health_plan, High confidence", () => {
    const snap = snapshotFromUnderstanding(
      understanding({
        signals: [
          sig("readiness_score", "oura", 78),
          sig("sleep_score", "oura", 82),
          sig("hrv", "oura", 60),
          sig("resting_hr", "oura", 54),
          sig("steps", "oura", 8000),
        ],
        connectedSources: ["oura", "manual"],
        overallConfidence: "high",
      })
    );
    expect(snap.recommendedPlanMode).toBe("full_health_plan");
    expect(snap.confidence.label).toBe("High");
    expect(snap.sources.map((s) => s.label)).toContain("Oura");
    expect(snap.metrics.find((m) => m.metric === "readiness_score")?.value).toBe(78);
    expect(snap.suggestCheckin).toBe(false);
  });

  it("Apple-only → usable plan WITHOUT any Oura/readiness data", () => {
    const snap = snapshotFromUnderstanding(
      understanding({
        // Apple has no readiness/sleep_score — only sleep_duration, hrv, etc.
        signals: [
          sig("sleep_duration_min", "apple_health", 430),
          sig("hrv", "apple_health", 42),
          sig("resting_hr", "apple_health", 58),
          sig("steps", "apple_health", 9000),
        ],
        connectedSources: ["apple_health", "manual"],
        overallConfidence: "medium",
      })
    );
    expect(snap.recommendedPlanMode).not.toBe("generic_plan");
    expect(snap.metrics.find((m) => m.metric === "readiness_score")).toBeUndefined();
    expect(snap.sources.map((s) => s.label)).toContain("Apple Health");
    expect(snap.sources.map((s) => s.label)).not.toContain("Oura");
  });

  it("Manual-only → plan still generates with manual mode and Low confidence", () => {
    const snap = snapshotFromUnderstanding(
      understanding({
        signals: [sig("mood", "manual", 4), sig("energy", "manual", 3)],
        connectedSources: ["manual"],
        overallConfidence: "low",
      })
    );
    expect(snap.recommendedPlanMode).toBe("manual_checkin_plan");
    expect(snap.confidence.label).toBe("Low");
    expect(snap.suggestCheckin).toBe(false); // they already checked in
  });

  it("Multiple sources → all source chips present", () => {
    const snap = snapshotFromUnderstanding(
      understanding({
        signals: [sig("readiness_score", "oura", 70), sig("steps", "apple_health", 11000)],
        connectedSources: ["oura", "apple_health", "manual"],
        overallConfidence: "high",
      })
    );
    const labels = snap.sources.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["Oura", "Apple Health", "Manual check-in"]));
    expect(snap.metrics.find((m) => m.metric === "steps")?.source).toBe("apple_health");
  });

  it("Stale wearable (connected but no signal today) → low confidence + suggests check-in", () => {
    const snap = snapshotFromUnderstanding(
      understanding({
        signals: [],
        connectedSources: ["oura", "manual"],
        overallConfidence: "low",
        warnings: ["Your wearable hasn't synced recently."],
      })
    );
    expect(snap.staleWearable).toBe(true);
    expect(snap.suggestCheckin).toBe(true);
    expect(snap.confidence.reasons).toContain("Your wearable hasn't synced recently.");
  });

  it("No source at all → generic plan, suggests a check-in", () => {
    const snap = snapshotFromUnderstanding(
      understanding({ signals: [], connectedSources: ["manual"], overallConfidence: "low" })
    );
    expect(snap.recommendedPlanMode).toBe("generic_plan");
    expect(snap.suggestCheckin).toBe(true);
  });
});

describe("provider registry — gating", () => {
  it("Garmin is gated and never reports enabled/available", () => {
    expect(isProviderEnabled("garmin")).toBe(false);
    const garmin = providerInfo("garmin")!;
    expect(providerState(garmin, { configured: false })).toBe("Gated");
    expect(providerState(garmin, { connected: true })).toBe("Gated");
  });

  it("Google Health is planned (or available only when configured), not generally enabled", () => {
    expect(isProviderEnabled("google_health")).toBe(false);
    const google = providerInfo("google_health")!;
    expect(providerState(google, { configured: false })).toBe("Planned");
    expect(providerState(google, { configured: true })).toBe("Available");
  });

  it("active providers reflect connection + config", () => {
    const oura = providerInfo("oura")!;
    expect(providerState(oura, { connected: true })).toBe("Connected");
    expect(providerState(oura, { connected: false })).toBe("Available");
    const fitbit = providerInfo("fitbit")!;
    expect(providerState(fitbit, { connected: false, configured: false })).toBe("Not configured");
  });

  it("every provider has a label and description", () => {
    for (const p of HEALTH_PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
});
