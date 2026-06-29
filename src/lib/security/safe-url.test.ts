import { describe, it, expect } from "vitest";
import { sanitizeNotificationUrl } from "./safe-url";

describe("sanitizeNotificationUrl", () => {
  it("allows a normal in-app path", () => {
    expect(sanitizeNotificationUrl("/nutrition")).toBe("/nutrition");
    expect(sanitizeNotificationUrl("/nutrition/share?shared=1")).toBe("/nutrition/share?shared=1");
    expect(sanitizeNotificationUrl("/dashboard#focus")).toBe("/dashboard#focus");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeNotificationUrl("//evil.com")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects absolute http(s) URLs", () => {
    expect(sanitizeNotificationUrl("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("http://evil.com/path")).toBe("/dashboard");
  });

  it("rejects dangerous schemes", () => {
    expect(sanitizeNotificationUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("data:text/html,<script>")).toBe("/dashboard");
  });

  it("rejects non-strings, empty, and over-long input", () => {
    expect(sanitizeNotificationUrl(null)).toBe("/dashboard");
    expect(sanitizeNotificationUrl(undefined)).toBe("/dashboard");
    expect(sanitizeNotificationUrl(42)).toBe("/dashboard");
    expect(sanitizeNotificationUrl("")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("/" + "a".repeat(600))).toBe("/dashboard");
  });

  it("rejects control characters and backslashes", () => {
    expect(sanitizeNotificationUrl("/foo\nbar")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("/foo\tbar")).toBe("/dashboard");
    expect(sanitizeNotificationUrl("/foo\\bar")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(sanitizeNotificationUrl("https://evil.com", "/home")).toBe("/home");
  });
});
