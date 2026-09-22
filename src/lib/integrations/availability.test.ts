import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  integrationsAvailable: {
    oura: () => true,
    google: () => true,
    fitbit: () => true,
    openai: () => true,
    resend: () => true,
    push: () => true,
  },
}));

import { availableIntegrations } from "./availability";

describe("user-facing integration availability", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not advertise paused production providers even when credentials exist", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEATHER_API_KEY", "configured-test-key");
    for (const available of Object.values(availableIntegrations)) {
      expect(available()).toBe(false);
    }
  });

  it("keeps configured development integrations available for isolated testing", () => {
    vi.stubEnv("NODE_ENV", "test");
    for (const available of Object.values(availableIntegrations)) {
      expect(available()).toBe(true);
    }
  });
});
