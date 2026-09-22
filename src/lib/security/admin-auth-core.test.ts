import { describe, expect, it } from "vitest";
import { matchAdminSecret } from "@/lib/security/admin-auth-core";

describe("dedicated admin action authentication", () => {
  const admin = "admin-action-secret-0123456789abcdef";
  const cron = "cron-scheduler-secret-0123456789abcd";

  it("accepts only the configured admin credential", () => {
    expect(matchAdminSecret(admin, admin)).toBe(true);
    expect(matchAdminSecret(cron, admin)).toBe(false);
    expect(matchAdminSecret("", admin)).toBe(false);
  });

  it("fails closed when the admin credential is not configured", () => {
    expect(matchAdminSecret(admin, undefined)).toBe(false);
  });
});
