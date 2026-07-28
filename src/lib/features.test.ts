import { describe, expect, it } from "vitest";
import { NEST_ENABLED, SOCIAL_FEATURES_ENABLED, SUBSCRIPTIONS_ENABLED } from "@/lib/features";

describe("safe production feature flags", () => {
  it("source-locks non-V1 surfaces off", () => {
    expect(NEST_ENABLED).toBe(false);
    expect(SOCIAL_FEATURES_ENABLED).toBe(false);
    expect(SUBSCRIPTIONS_ENABLED).toBe(false);
  });
});
