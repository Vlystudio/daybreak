import { describe, expect, it } from "vitest";
import {
  AI_CONSENT_VERSION,
  DEFAULT_AI_CONSENT,
  aiConsentCategories,
  aiConsentFromPrefs,
  gateContext,
  hasCurrentAiConsentDecision,
  redactEventTitle,
} from "./ai-consent";

describe("granular AI consent", () => {
  it("defaults all eight categories to denied", () => {
    expect(aiConsentFromPrefs(null)).toEqual(DEFAULT_AI_CONSENT);
    expect(aiConsentFromPrefs({})).toEqual(DEFAULT_AI_CONSENT);
  });

  it("includes only explicit true values and does not let detail imply availability", () => {
    expect(
      aiConsentFromPrefs({
        allow_ai_basic_processing: true,
        allow_ai_calendar_availability: false,
        allow_ai_calendar_detail: true,
        allow_ai_health_context: true,
      })
    ).toMatchObject({
      basic: true,
      health: true,
      calendarAvailability: false,
      calendarDetail: false,
    });
  });

  it("maps each affirmative choice to a bounded gateway category", () => {
    expect(
      aiConsentCategories({
        ...DEFAULT_AI_CONSENT,
        basic: true,
        tasks: true,
        calendarAvailability: true,
      })
    ).toEqual(["basic", "tasks", "calendar_availability"]);
  });
});

describe("current AI decision", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");
  const current = {
    allow_ai_basic_processing: false,
    ai_consent_version: AI_CONSENT_VERSION,
    ai_consent_updated_at: "2026-07-28T10:00:00.000Z",
    ai_consent_expires_at: "2027-01-24T10:00:00.000Z",
  };

  it("recognizes an explicit decline-all as a recorded current decision", () => {
    expect(hasCurrentAiConsentDecision(current, now)).toBe(true);
  });

  it("fails closed for missing, old-version, invalid, and expired decisions", () => {
    expect(hasCurrentAiConsentDecision(null, now)).toBe(false);
    expect(hasCurrentAiConsentDecision({ ...current, ai_consent_version: "old" }, now)).toBe(false);
    expect(hasCurrentAiConsentDecision({ ...current, ai_consent_expires_at: "invalid" }, now)).toBe(
      false
    );
    expect(
      hasCurrentAiConsentDecision(
        { ...current, ai_consent_expires_at: "2026-07-28T11:59:59.000Z" },
        now
      )
    ).toBe(false);
  });
});

describe("sensitive context minimization", () => {
  it("omits health and check-in values unless allowed", () => {
    expect(gateContext({ metrics: [], sources: ["Oura"] }, false)).toBeNull();
    expect(gateContext("slept badly, knee hurts", false)).toBeNull();
  });

  it("replaces a private title while retaining an authorized busy block", () => {
    expect(redactEventTitle("Therapy with Dr. Lee", false)).toBe("Busy time");
    expect(redactEventTitle("Therapy with Dr. Lee", true)).toBe("Therapy with Dr. Lee");
  });
});
