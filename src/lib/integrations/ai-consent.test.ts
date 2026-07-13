import { describe, it, expect } from "vitest";
import {
  AI_CONSENT_VERSION,
  aiConsentFromPrefs,
  gateContext,
  hasCurrentAiConsentDecision,
  redactEventTitle,
} from "./ai-consent";

describe("aiConsentFromPrefs", () => {
  it("defaults every context to denied when prefs are missing", () => {
    expect(aiConsentFromPrefs(null)).toEqual({ health: false, calendar: false, checkin: false });
    expect(aiConsentFromPrefs(undefined)).toEqual({
      health: false,
      calendar: false,
      checkin: false,
    });
    expect(aiConsentFromPrefs({})).toEqual({ health: false, calendar: false, checkin: false });
  });

  it("treats null as denied and includes only explicit true values", () => {
    expect(
      aiConsentFromPrefs({
        allow_ai_health_context: null,
        allow_ai_calendar_context: true,
        allow_ai_checkin_context: false,
      })
    ).toEqual({ health: false, calendar: true, checkin: false });
  });
});

describe("hasCurrentAiConsentDecision", () => {
  it("requires both the current disclosure version and a timestamp", () => {
    expect(hasCurrentAiConsentDecision(null)).toBe(false);
    expect(hasCurrentAiConsentDecision({ ai_consent_version: AI_CONSENT_VERSION })).toBe(false);
    expect(
      hasCurrentAiConsentDecision({
        ai_consent_version: AI_CONSENT_VERSION,
        ai_consent_updated_at: "2026-07-13T12:00:00.000Z",
      })
    ).toBe(true);
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
    expect(redactEventTitle("Therapy with Dr. Lee", false)).toBe("Busy time");
  });
});
