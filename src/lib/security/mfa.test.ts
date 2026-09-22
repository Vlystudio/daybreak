import { describe, expect, it } from "vitest";
import { requiresMfaChallenge, safePostAuthPath } from "@/lib/security/mfa";

describe("MFA auth gate", () => {
  it("requires AAL2 only when a verified factor makes it the next level", () => {
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(requiresMfaChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });

  it("accepts only same-origin relative post-auth destinations", () => {
    expect(safePostAuthPath("/settings?tab=security")).toBe("/settings?tab=security");
    expect(safePostAuthPath("https://evil.test")).toBe("/dashboard");
    expect(safePostAuthPath("//evil.test")).toBe("/dashboard");
    expect(safePostAuthPath("/login/mfa")).toBe("/dashboard");
  });
});
