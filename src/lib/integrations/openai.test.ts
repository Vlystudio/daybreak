import { describe, it, expect } from "vitest";
import { inputHash } from "@/lib/integrations/openai";

describe("inputHash", () => {
  it("is stable for identical input", () => {
    expect(inputHash({ a: 1, b: [2, 3] })).toBe(inputHash({ a: 1, b: [2, 3] }));
  });

  it("changes when the input changes", () => {
    expect(inputHash({ a: 1 })).not.toBe(inputHash({ a: 2 }));
  });

  it("returns a 64-char hex SHA-256 digest", () => {
    expect(inputHash({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
