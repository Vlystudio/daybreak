import { describe, expect, it } from "vitest";
import { onboardingSchema, signupSchema } from "@/lib/validation";

const valid = {
  email: "adult@example.invalid",
  password: "long-password",
  displayName: "Adult",
  adultAttested: true,
  acceptedTerms: true,
  privacyAcknowledged: true,
};

describe("adult-only signup validation", () => {
  it("accepts a complete explicit adult decision", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["adultAttested", "acceptedTerms", "privacyAcknowledged"] as const)(
    "rejects when %s is false",
    (field) => {
      expect(signupSchema.safeParse({ ...valid, [field]: false }).success).toBe(false);
    }
  );
});

describe("onboarding age minimization", () => {
  it("does not accept or preserve legacy birth-year input", () => {
    const result = onboardingSchema.parse({
      workType: "office",
      fitnessGoal: "maintain",
      activityLevel: "moderate",
      exerciseFrequency: "3-4",
      socialTendency: "balanced",
      planningScope: "full_week",
      birthYear: 2012,
    });
    expect(result).not.toHaveProperty("birthYear");
  });
});
