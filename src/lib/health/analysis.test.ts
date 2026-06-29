import { describe, it, expect } from "vitest";
import { fuseDailySignals, latestSignals } from "./fusion";
import { buildBaselines, type DatedValue } from "./baselines";
import { detectSourceConflicts, generateInsights } from "./analysis";
import { buildAiHealthInput } from "./ai-input";
import type {
  HealthBaseline,
  HealthMetricName,
  HealthSource,
  HealthUnderstandingResult,
  RawHealthObservation,
} from "./types";

function obs(
  metric: HealthMetricName,
  source: HealthSource,
  value: number,
  date: string
): RawHealthObservation {
  return { userId: "u1", date, metric, source, value };
}

/** Run the deterministic pipeline (baselines → fuse → latest), no DB. */
function pipeline(observations: RawHealthObservation[]) {
  const seriesMap = new Map<HealthMetricName, DatedValue[]>();
  for (const o of observations) {
    if (typeof o.value !== "number") continue;
    const list = seriesMap.get(o.metric) ?? [];
    list.push({ date: o.date, value: o.value });
    seriesMap.set(o.metric, list);
  }
  const baselines = new Map<HealthMetricName, HealthBaseline>(
    buildBaselines(seriesMap).map((b) => [b.metric, b])
  );
  const signals = fuseDailySignals(observations, {
    baselines,
    connectedSources: ["oura", "apple_health"],
  });
  return { signals, baselines, latest: latestSignals(signals) };
}

/** N days of Oura recovery data; the final day has high RHR + low HRV vs baseline. */
function recoveryObs(days: number): RawHealthObservation[] {
  const start = Date.parse("2026-01-01");
  const out: RawHealthObservation[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const last = i === days - 1;
    out.push(obs("resting_hr", "oura", last ? 64 : 54, date));
    out.push(obs("hrv", "oura", last ? 45 : 65, date));
  }
  return out;
}

describe("source conflicts", () => {
  it("flags a major conflict when resting HR diverges across trackers", () => {
    const signals = fuseDailySignals(
      [
        obs("resting_hr", "oura", 55, "2026-06-01"),
        obs("resting_hr", "apple_health", 70, "2026-06-01"),
      ],
      { connectedSources: ["oura", "apple_health"] }
    );
    const conflict = detectSourceConflicts(signals).find((c) => c.metric === "resting_hr");
    expect(conflict).toBeDefined();
    expect(conflict?.severity).toBe("major");
    expect(conflict?.recommendedPrimarySource).toBe("oura");
  });
});

describe("insights require enough data", () => {
  it("makes no trend claim with < 14 days of history", () => {
    const { latest, baselines } = pipeline(recoveryObs(10));
    const insights = generateInsights({ latest, baselines });
    expect(insights.find((i) => i.type === "recovery")).toBeUndefined();
  });

  it("makes a cautious, non-diagnostic recovery insight with 30+ days", () => {
    const { latest, baselines } = pipeline(recoveryObs(30));
    const rec = generateInsights({ latest, baselines }).find((i) => i.type === "recovery");
    expect(rec).toBeDefined();
    expect(rec?.message).toMatch(/may|can follow|baseline/i);
    expect(rec?.message.toLowerCase()).not.toMatch(/you are sick|you have |diagnos/);
  });
});

describe("AI input is fused, not raw", () => {
  it("passes confidence-tagged daily signals + deterministic insights, never raw multi-source rows", () => {
    const signals = fuseDailySignals(
      [
        obs("resting_hr", "oura", 55, "2026-01-30"),
        obs("resting_hr", "apple_health", 58, "2026-01-30"),
        obs("steps", "apple_health", 9000, "2026-01-30"),
      ],
      { connectedSources: ["oura", "apple_health"] }
    );
    const result: HealthUnderstandingResult = {
      dateRange: { from: "2026-01-01", to: "2026-01-30" },
      dailySignals: signals,
      baselines: [],
      insights: [
        {
          type: "recovery",
          severity: "watch",
          title: "t",
          message: "m",
          confidence: "medium",
          reasons: [],
          relatedMetrics: [],
        },
      ],
      sourceConflicts: [],
      dataQuality: {
        overallConfidence: "medium",
        connectedSources: ["oura", "apple_health", "manual"],
        missingSources: [],
        coverageByMetric: {},
        warnings: [],
      },
      summary: {
        recoveryStatus: "normal",
        sleepStatus: "unknown",
        activityStatus: "normal",
        stressStatus: "unknown",
        topInsights: [],
      },
    };

    const ai = buildAiHealthInput(result);
    const rhr = ai.keySignals.find((s) => s.metric === "resting_hr");
    expect(rhr?.primarySource).toBe("oura"); // already fused to a single source
    expect(rhr?.confidence).toBeDefined();
    expect(ai.deterministicInsights.length).toBeGreaterThan(0);
    // The AI never sees a raw per-source observations array.
    const bag = ai as unknown as Record<string, unknown>;
    expect(bag.observations).toBeUndefined();
    expect(bag.dailySignals).toBeUndefined();
  });
});
