import { describe, expect, it } from "vitest";
import { scopeAllowsWrite } from "./google-calendar";

describe("Google Calendar granted-scope parsing", () => {
  it("accepts only exact write-capable scope tokens", () => {
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar")).toBe(true);
    expect(
      scopeAllowsWrite(
        "openid https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email"
      )
    ).toBe(true);
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar.events.owned")).toBe(true);
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar.app.created")).toBe(true);
  });

  it("rejects read-only, prefixed, suffixed, and missing scopes", () => {
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar.readonly")).toBe(false);
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar.events.readonly")).toBe(
      false
    );
    expect(scopeAllowsWrite("https://evil.invalid/https://www.googleapis.com/auth/calendar")).toBe(
      false
    );
    expect(scopeAllowsWrite("https://www.googleapis.com/auth/calendar.evil")).toBe(false);
    expect(scopeAllowsWrite(null)).toBe(false);
  });
});
