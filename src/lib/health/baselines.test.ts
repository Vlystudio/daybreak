import { describe, it, expect } from "vitest";
import { baselineConfidence, buildBaseline, hasEnoughForTrend, type DatedValue } from "./baselines";

function series(n: number, value = 55): DatedValue[] {
  const start = Date.parse("2026-01-01");
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

describe("personal baselines", () => {
  it("confidence grows with history length", () => {
    expect(baselineConfidence(10)).toBe("low");
    expect(baselineConfidence(20)).toBe("low"); // 14–29: still cautious
    expect(baselineConfidence(35)).toBe("medium");
    expect(baselineConfidence(70)).toBe("high");
  });

  it("< 14 days of history prevents trend claims", () => {
    const b = buildBaseline("resting_hr", series(10));
    expect(b.sampleCount).toBe(10);
    expect(b.confidence).toBe("low");
    expect(hasEnoughForTrend(b)).toBe(false);
  });

  it("30+ days allows a normal baseline claim", () => {
    const b = buildBaseline("resting_hr", series(35, 54));
    expect(b.confidence).toBe("medium");
    expect(hasEnoughForTrend(b)).toBe(true);
    expect(b.baseline).toBeCloseTo(54, 1);
  });
});
