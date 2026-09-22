import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "@/lib/security/sentry-scrub";

describe("Sentry event scrubbing", () => {
  it("removes content, user, request, context, and breadcrumbs", () => {
    const result = scrubSentryEvent({
      message: "heart rate 170 for person@example.test",
      user: { email: "person@example.test" },
      request: { data: "prompt" },
      extra: { health: 170 },
      contexts: { calendar: "Therapy" },
      breadcrumbs: [{ message: "check-in" }],
      exception: { values: [{ type: "HealthError", value: "raw health value", stacktrace: {} }] },
    });
    expect(result.message).toBe("[redacted]");
    expect(result.user).toBeUndefined();
    expect(result.request).toBeUndefined();
    expect(result.extra).toBeUndefined();
    expect(result.contexts).toBeUndefined();
    expect(result.breadcrumbs).toBeUndefined();
    expect(result.exception?.values?.[0]).toMatchObject({
      type: "HealthError",
      value: "[redacted]",
    });
  });
});
