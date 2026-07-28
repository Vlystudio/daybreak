import { describe, expect, it } from "vitest";
import { renderWeeklyDigest, WEEKLY_NOTIFICATION } from "@/lib/weekly-digest";

describe("weekly notification privacy", () => {
  it("contains no health, calendar, check-in, nutrition, or personalized values", () => {
    const output = JSON.stringify({
      ...WEEKLY_NOTIFICATION,
      ...renderWeeklyDigest(),
    }).toLowerCase();
    for (const sensitive of [
      "readiness",
      "sleep score",
      "heart rate",
      "therapy",
      "calories",
      "check-in",
      "mood",
      "calendar",
    ]) {
      expect(output).not.toContain(sensitive);
    }
    expect(output).toContain("open daybreak");
  });
});
