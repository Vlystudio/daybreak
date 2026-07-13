import { describe, expect, it } from "vitest";
import { enabledOnlyWhenExplicitlyTrue } from "@/lib/features";

describe("safe production feature flags", () => {
  it("defaults missing and malformed values to disabled", () => {
    expect(enabledOnlyWhenExplicitlyTrue(undefined)).toBe(false);
    expect(enabledOnlyWhenExplicitlyTrue("false")).toBe(false);
    expect(enabledOnlyWhenExplicitlyTrue("TRUE")).toBe(false);
  });

  it("enables only an explicit lowercase true", () => {
    expect(enabledOnlyWhenExplicitlyTrue("true")).toBe(true);
  });
});
