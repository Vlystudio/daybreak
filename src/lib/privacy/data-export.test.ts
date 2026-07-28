import { describe, expect, it } from "vitest";
import { PORTABLE_EXPORT_TABLES, sanitizePortableExport } from "@/lib/privacy/data-export";

describe("portable data export", () => {
  it("removes credentials and internal authorization state recursively", () => {
    const result = sanitizePortableExport({
      email: "person@example.test",
      nested: { access_token_enc: "ciphertext", status_token_hash: "hash", note: "mine" },
      processor_propagation_state: { vendor: "pending" },
    });
    expect(result).toEqual({ email: "person@example.test", nested: { note: "mine" } });
  });

  it("never exports token-bearing tables with wildcard fields", () => {
    const notifications = PORTABLE_EXPORT_TABLES.find(
      (item) => item.table === "notification_settings"
    );
    expect(notifications?.select).not.toContain("unsubscribe_token");
    expect(PORTABLE_EXPORT_TABLES.some((item) => item.table === "oauth_connections")).toBe(false);
    expect(PORTABLE_EXPORT_TABLES.some((item) => item.table === "ai_processing_permits")).toBe(
      false
    );
  });
});
