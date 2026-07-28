import { describe, expect, it } from "vitest";
import { isCurrentEligibility } from "@/lib/account-eligibility";

describe("account eligibility", () => {
  const current = {
    status: "eligible" as const,
    adult_attested: true,
    adult_attestation_version: "2026-07-28",
    terms_version: "2026-07-28",
    privacy_version: "2026-07-28",
  };

  it("requires every current adult/legal field", () => {
    expect(isCurrentEligibility(current)).toBe(true);
    expect(isCurrentEligibility({ ...current, adult_attested: false })).toBe(false);
    expect(isCurrentEligibility({ ...current, terms_version: "old" })).toBe(false);
    expect(isCurrentEligibility({ ...current, privacy_version: null })).toBe(false);
  });

  it("denies pending, restricted, suspended, deleted, and missing rows", () => {
    for (const status of [
      "pending_adult_attestation",
      "restricted_minor",
      "suspended",
      "deletion_pending",
    ] as const) {
      expect(isCurrentEligibility({ ...current, status })).toBe(false);
    }
    expect(isCurrentEligibility(null)).toBe(false);
  });
});
