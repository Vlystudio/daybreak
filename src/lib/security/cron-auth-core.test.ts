import { describe, it, expect } from "vitest";
import { matchCronSecret, safeEqual } from "./cron-auth-core";

describe("safeEqual (constant-time compare)", () => {
  it("is true for identical strings", () => {
    expect(safeEqual("a-secret-value", "a-secret-value")).toBe(true);
  });
  it("is false for different strings of equal length", () => {
    expect(safeEqual("a-secret-valuE", "a-secret-value")).toBe(false);
  });
  it("is false for different lengths", () => {
    expect(safeEqual("short", "longer-value")).toBe(false);
  });
});

describe("matchCronSecret (rotation-aware)", () => {
  const current = "current-secret-0123456789abcdef";
  const previous = "previous-secret-0123456789abcdef";
  const secrets = [current, previous];

  it("rejects a missing/empty token", () => {
    expect(matchCronSecret("", secrets)).toBe(-1);
  });
  it("rejects a wrong token", () => {
    expect(matchCronSecret("not-the-secret", secrets)).toBe(-1);
  });
  it("accepts the current secret (index 0)", () => {
    expect(matchCronSecret(current, secrets)).toBe(0);
  });
  it("accepts the previous secret during rotation (index 1)", () => {
    expect(matchCronSecret(previous, secrets)).toBe(1);
  });
  it("rejects everything when no secrets are configured", () => {
    expect(matchCronSecret(current, [])).toBe(-1);
  });
  it("ignores empty configured secrets", () => {
    expect(matchCronSecret("", [""])).toBe(-1);
    expect(matchCronSecret("x", [""])).toBe(-1);
  });
});
