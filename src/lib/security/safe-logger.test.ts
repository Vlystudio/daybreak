import { afterEach, describe, expect, it, vi } from "vitest";
import { safeLog } from "@/lib/security/safe-logger";

describe("safeLog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts classified values and token-like strings", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    safeLog("error", "test.failure", {
      health: { hrv: 41 },
      calendar_title: "Private appointment",
      email: "person@example.com",
      detail: "Bearer abc.def and eyJabc.def.ghi",
      error: new TypeError("raw private message"),
    });
    const serialized = String(log.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("41");
    expect(serialized).not.toContain("Private appointment");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("abc.def");
    expect(serialized).not.toContain("raw private message");
    expect(serialized).toContain("TypeError");
  });
});
