import { describe, it, expect } from "vitest";
import { fuseDailySignals } from "./fusion";
import type { HealthMetricName, HealthSource, RawHealthObservation } from "./types";

function obs(
  metric: HealthMetricName,
  source: HealthSource,
  value: number,
  date = "2026-06-01"
): RawHealthObservation {
  return { userId: "u1", date, metric, source, value };
}

const connected: HealthSource[] = ["oura", "apple_health"];

describe("fuseDailySignals — source-aware fusion", () => {
  it("Oura and Apple agree on sleep duration → Oura primary, high confidence", () => {
    const [s] = fuseDailySignals(
      [obs("sleep_duration_min", "oura", 452), obs("sleep_duration_min", "apple_health", 448)],
      { connectedSources: connected }
    );
    expect(s.primarySource).toBe("oura");
    expect(s.value).toBe(452);
    expect(s.confidence).toBe("high");
  });

  it("Oura and Apple disagree on sleep duration → Oura wins, confidence drops, value not averaged", () => {
    const [s] = fuseDailySignals(
      [obs("sleep_duration_min", "oura", 450), obs("sleep_duration_min", "apple_health", 600)],
      { connectedSources: connected }
    );
    expect(s.primarySource).toBe("oura");
    expect(s.value).toBe(450); // NOT the 525 average
    expect(s.confidence).not.toBe("high");
    expect(s.disagreementScore ?? 0).toBeGreaterThan(0.5);
  });

  it("Missing Oura → Apple Health fallback with lower (non-high) confidence", () => {
    const [s] = fuseDailySignals([obs("resting_hr", "apple_health", 60)], {
      connectedSources: ["apple_health"],
    });
    expect(s.primarySource).toBe("apple_health");
    expect(s.confidence).not.toBe("high");
    expect(s.confidenceReasons.join(" ")).toMatch(/fallback/i);
  });

  it("Apple steps are primary over Oura steps", () => {
    const [s] = fuseDailySignals([obs("steps", "oura", 8000), obs("steps", "apple_health", 9000)], {
      connectedSources: connected,
    });
    expect(s.primarySource).toBe("apple_health");
    expect(s.value).toBe(9000);
  });

  it("HRV is never averaged across Oura and Apple (different measurement windows)", () => {
    const [s] = fuseDailySignals([obs("hrv", "oura", 60), obs("hrv", "apple_health", 40)], {
      connectedSources: connected,
    });
    expect(s.primarySource).toBe("oura"); // overnight recovery HRV
    expect(s.value).toBe(60); // not (60 + 40) / 2 = 50
    expect(s.confidenceReasons.join(" ")).toMatch(/different windows|not averaged/i);
    // Both source values are preserved as provenance.
    expect(s.sourceValues).toMatchObject({ oura: 60, apple_health: 40 });
  });

  it("Calories are never high confidence, even when sources agree", () => {
    const [s] = fuseDailySignals(
      [obs("active_calories", "apple_watch", 500), obs("active_calories", "apple_health", 505)],
      { connectedSources: ["apple_watch", "apple_health"] }
    );
    expect(s.confidence).not.toBe("high");
  });
});
