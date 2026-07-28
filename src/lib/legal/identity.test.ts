import { describe, expect, it } from "vitest";
import { LEGAL_IDENTITY_KEYS, validateProductionLegalIdentity } from "@/lib/legal/identity";

const valid = Object.fromEntries(LEGAL_IDENTITY_KEYS.map((key) => [key, ""])) as Record<
  string,
  string
>;
Object.assign(valid, {
  LEGAL_OPERATOR_NAME: "Sunrise Operations LLC",
  LEGAL_PUBLIC_DEVELOPER_NAME: "Sunrise Operations",
  LEGAL_GOVERNING_JURISDICTION: "New York, United States",
  LEGAL_BUSINESS_ADDRESS: "500 Market Street, Albany, New York 12207, United States",
  LEGAL_PRIVACY_EMAIL: "privacy@sunrise.test",
  LEGAL_SECURITY_EMAIL: "security@sunrise.test",
  LEGAL_SUPPORT_EMAIL: "support@sunrise.test",
  LEGAL_TERMS_EFFECTIVE_DATE: "2026-07-28",
  LEGAL_PRIVACY_EFFECTIVE_DATE: "2026-07-28",
  LEGAL_HEALTH_PRIVACY_EFFECTIVE_DATE: "2026-07-28",
  LEGAL_COPYRIGHT_OWNER: "Sunrise Operations LLC",
  LEGAL_APP_STORE_SELLER_NAME: "Sunrise Operations LLC",
  LEGAL_SUPPORT_URL: "https://sunrise.test/support",
  LEGAL_PRIVACY_URL: "https://sunrise.test/privacy",
  LEGAL_TERMS_URL: "https://sunrise.test/terms",
});

describe("production legal identity", () => {
  it("accepts a complete non-placeholder identity", () => {
    expect(validateProductionLegalIdentity(valid).ok).toBe(true);
  });

  it.each(["TODO", "TBD", "Acme LLC", "example.com", "localhost", "123 Main Street"])(
    "rejects placeholder-like value %s",
    (placeholder) => {
      expect(
        validateProductionLegalIdentity({ ...valid, LEGAL_OPERATOR_NAME: placeholder }).ok
      ).toBe(false);
    }
  );

  it("rejects missing values and non-HTTPS public URLs", () => {
    const result = validateProductionLegalIdentity({
      ...valid,
      LEGAL_BUSINESS_ADDRESS: "",
      LEGAL_SUPPORT_URL: "http://sunrise.test/support",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
