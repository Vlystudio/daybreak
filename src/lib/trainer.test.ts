import { describe, it, expect } from "vitest";
import { computeTargets } from "@/lib/trainer";
import type { UserPreferences } from "@/lib/planning";

function prefs(over: Partial<UserPreferences> = {}): UserPreferences {
  return {
    height_in: 70,
    weight_lb: 180,
    sex: "male",
    activity_level: "moderate",
    fitness_goal: "maintain",
    ...over,
  } as UserPreferences;
}

describe("computeTargets", () => {
  it("returns null without height or weight", () => {
    expect(computeTargets(prefs({ height_in: null }))).toBeNull();
    expect(computeTargets(prefs({ weight_lb: null }))).toBeNull();
  });

  it("applies a deficit for weight loss vs maintenance", () => {
    const maintain = computeTargets(prefs({ fitness_goal: "maintain" }))!;
    const loss = computeTargets(prefs({ fitness_goal: "weight_loss" }))!;
    expect(loss.calories).toBeLessThan(maintain.calories);
  });

  it("applies a surplus for muscle gain vs maintenance", () => {
    const maintain = computeTargets(prefs({ fitness_goal: "maintain" }))!;
    const gain = computeTargets(prefs({ fitness_goal: "muscle_gain" }))!;
    expect(gain.calories).toBeGreaterThan(maintain.calories);
  });

  it("never drops below the 1200 kcal floor", () => {
    const t = computeTargets(
      prefs({
        weight_lb: 90,
        height_in: 58,
        fitness_goal: "weight_loss",
        activity_level: "sedentary",
      })
    )!;
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });

  it("computes positive macro targets", () => {
    const t = computeTargets(prefs())!;
    expect(Number.isInteger(t.protein)).toBe(true);
    expect(t.protein).toBeGreaterThan(0);
    expect(t.carbs).toBeGreaterThanOrEqual(0);
    expect(t.fat).toBeGreaterThan(0);
  });
});
