import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, signState, verifyState } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips a secret", () => {
    const s = "refresh-token-secret-123";
    expect(decryptToken(encryptToken(s))).toBe(s);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });

  it("emits the legacy 3-part format with the default key (zero-risk deploy)", () => {
    expect(encryptToken("x").split(".")).toHaveLength(3);
  });

  it("still decrypts legacy / unversioned ciphertext", () => {
    const ct = encryptToken("hello"); // 3-part with the default key
    expect(decryptToken(ct)).toBe("hello");
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptToken("garbage")).toThrow();
    expect(() => decryptToken("a.b")).toThrow();
  });

  it("fails to decrypt a tampered tag (GCM integrity)", () => {
    const [iv, , data] = encryptToken("hi").split(".");
    expect(() => decryptToken(`${iv}.AAAAAAAAAAAAAAAAAAAAAA==.${data}`)).toThrow();
  });
});

describe("signed OAuth state", () => {
  it("round-trips and verifies", () => {
    const signed = signState("user-123:nonce-abc");
    expect(verifyState(signed)).toBe("user-123:nonce-abc");
  });

  it("rejects a tampered value", () => {
    const signed = signState("user-123:nonce-abc");
    const tampered = signed.replace("user-123", "user-999");
    expect(verifyState(tampered)).toBeNull();
  });
});
