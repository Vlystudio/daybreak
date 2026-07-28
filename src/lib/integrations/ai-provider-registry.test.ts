import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAiProviderEnabled,
  registeredAiProviderIds,
} from "@/lib/integrations/ai-provider-registry";

describe("AI provider registry", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("contains every implemented external AI destination", () => {
    expect(registeredAiProviderIds()).toEqual(["logmeal", "openai"]);
  });

  it("allows reviewed development/test use", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(() => assertAiProviderEnabled("openai")).not.toThrow();
    expect(() => assertAiProviderEnabled("logmeal")).not.toThrow();
  });

  it("blocks production until external approval is recorded", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertAiProviderEnabled("openai")).toThrow(/not enabled|approval/i);
    expect(() => assertAiProviderEnabled("logmeal")).toThrow(/not enabled|approval/i);
  });
});
