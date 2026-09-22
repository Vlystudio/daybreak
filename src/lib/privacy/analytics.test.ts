import { describe, expect, it } from "vitest";
import { validateAnalyticsEvent } from "@/lib/privacy/analytics";

describe("analytics boundary", () => {
  it("accepts only registered events and allowlisted primitive fields", () => {
    expect(
      validateAnalyticsEvent("feature_completed", { feature: "schedule", success: true }).ok
    ).toBe(true);
    expect(validateAnalyticsEvent("made_up", {}).ok).toBe(false);
    expect(validateAnalyticsEvent("feature_completed", { arbitrary: "value" }).ok).toBe(false);
    expect(validateAnalyticsEvent("feature_completed", { feature: { nested: true } }).ok).toBe(
      false
    );
  });

  it.each([
    { health: 55 },
    { feature: "sleep-score" },
    { calendarTitle: "Therapy" },
    { feature: "checkin" },
    { email: "person@example.test" },
  ])("rejects sensitive analytics metadata %#", (metadata) => {
    expect(validateAnalyticsEvent("feature_completed", metadata).ok).toBe(false);
  });
});
