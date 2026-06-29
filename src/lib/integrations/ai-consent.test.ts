import { describe, it, expect } from "vitest";
import { aiConsentFromPrefs, gateContext, redactEventTitle } from "./ai-consent";

describe("aiConsentFromPrefs", () => {
  it("defaults every context to allowed when prefs are missing", () => {
    expect(aiConsentFromPrefs(null)).toEqual({ health: true, calendar: true, checkin: true });
    expect(aiConsentFromPrefs(undefined)).toEqual({ health: true, calendar: true, checkin: true });
    expect(aiConsentFromPrefs({})).toEqual({ health: true, calendar: true, checkin: true });
  });

  it("respects explicit opt-outs", () => {
    expect(
      aiConsentFromPrefs({
        allow_ai_health_context: false,
        allow_ai_calendar_context: true,
        allow_ai_checkin_context: false,
      })
    ).toEqual({ health: false, calendar: true, checkin: false });
  });
});

describe("gateContext (health / check-in)", () => {
  it("passes the value through when allowed", () => {
    const snapshot = { metrics: [{ metric: "hrv" }], sources: ["Oura"] };
    expect(gateContext(snapshot, true)).toBe(snapshot);
  });
  it("drops the value to null when not allowed (no health/source labels sent)", () => {
    expect(gateContext({ metrics: [], sources: ["Oura"] }, false)).toBeNull();
    expect(gateContext("slept badly, knee hurts", false)).toBeNull(); // free-text check-in note
  });
});

describe("redactEventTitle (calendar)", () => {
  it("keeps the title when calendar context is allowed", () => {
    expect(redactEventTitle("Therapy with Dr. Lee", true)).toBe("Therapy with Dr. Lee");
  });
  it("replaces the title with a generic label when calendar context is off", () => {
    expect(redactEventTitle("Therapy with Dr. Lee", false)).toBe("Busy");
  });
});
