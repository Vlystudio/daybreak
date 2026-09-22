import { describe, expect, it } from "vitest";
import {
  HEALTHKIT_READ_TYPES,
  initialHealthKitStart,
} from "@/lib/integrations/apple-health/healthkit.client";

describe("HealthKit V1 scope", () => {
  it("does not request broad medical or unused long-tail categories", () => {
    expect(HEALTHKIT_READ_TYPES).not.toContain("HKQuantityTypeIdentifierBloodGlucose");
    expect(HEALTHKIT_READ_TYPES).not.toContain("HKQuantityTypeIdentifierBloodPressureSystolic");
    expect(HEALTHKIT_READ_TYPES).not.toContain("HKQuantityTypeIdentifierBloodPressureDiastolic");
    expect(HEALTHKIT_READ_TYPES).not.toContain("HKQuantityTypeIdentifierBodyTemperature");
    expect(HEALTHKIT_READ_TYPES).toContain("HKCategoryTypeIdentifierSleepAnalysis");
    expect(HEALTHKIT_READ_TYPES).toContain("HKWorkoutTypeIdentifier");
  });

  it("defaults first import calculations to 90 days", () => {
    expect(initialHealthKitStart(new Date("2026-07-13T12:00:00Z"))).toEqual(
      new Date("2026-04-14T12:00:00Z")
    );
  });

  it("supports an explicit one-year import", () => {
    expect(initialHealthKitStart(new Date("2026-07-13T12:00:00Z"), 365)).toEqual(
      new Date("2025-07-13T12:00:00Z")
    );
  });
});
