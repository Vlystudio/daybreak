import { describe, expect, it } from "vitest";
import {
  NEST_ENABLED,
  SOCIAL_FEATURES_ENABLED,
  SUBSCRIPTIONS_ENABLED,
  GROCERY_ENABLED,
  COACH_ENABLED,
  NUTRITION_ENABLED,
  isAiPurposeEnabled,
} from "@/lib/features";
import manifest from "@/app/manifest";

describe("safe production feature flags", () => {
  it("source-locks non-V1 surfaces off", () => {
    expect(NEST_ENABLED).toBe(false);
    expect(SOCIAL_FEATURES_ENABLED).toBe(false);
    expect(SUBSCRIPTIONS_ENABLED).toBe(false);
    expect(GROCERY_ENABLED).toBe(false);
    expect(COACH_ENABLED).toBe(false);
    expect(NUTRITION_ENABLED).toBe(false);
  });
  it("keeps core AI available and refuses deferred or unknown purposes", () => {
    for (const purpose of ["morning_briefing", "daily_plan", "health_analysis", "health_checkin"])
      expect(isAiPurposeEnabled(purpose)).toBe(true);
    for (const purpose of [
      "meal_plan",
      "workout_plan",
      "fitness_plan",
      "food_image",
      "receipt_image",
      "unknown",
    ])
      expect(isAiPurposeEnabled(purpose)).toBe(false);
    expect(manifest()).not.toHaveProperty("share_target");
  });
});
