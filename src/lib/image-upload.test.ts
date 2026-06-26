import { describe, it, expect } from "vitest";
import { validateImageDataUrl } from "@/lib/image-upload";

function dataUrl(mime: string, bytes: number[]): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];

describe("validateImageDataUrl", () => {
  it("accepts a real JPEG", () => {
    const r = validateImageDataUrl(dataUrl("image/jpeg", JPEG));
    expect(r).toMatchObject({ ok: true, mime: "image/jpeg" });
  });

  it("accepts a real PNG", () => {
    expect(validateImageDataUrl(dataUrl("image/png", PNG)).ok).toBe(true);
  });

  it("rejects a non-data-URL string", () => {
    expect(validateImageDataUrl("https://evil.example/x.png").ok).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(validateImageDataUrl(12345).ok).toBe(false);
  });

  it("rejects bytes that aren't a supported image (disguised payload)", () => {
    const r = validateImageDataUrl(dataUrl("image/png", [0x4d, 0x5a, 0x90, 0x00])); // "MZ" = PE exe
    expect(r.ok).toBe(false);
  });

  it("rejects a forged header (declared PNG, actually JPEG bytes)", () => {
    const r = validateImageDataUrl(dataUrl("image/png", JPEG));
    expect(r.ok).toBe(false);
  });

  it("rejects oversize payloads", () => {
    const r = validateImageDataUrl(dataUrl("image/jpeg", JPEG), 4);
    expect(r.ok).toBe(false);
  });

  it("rejects an empty image", () => {
    expect(validateImageDataUrl("data:image/png;base64,").ok).toBe(false);
  });
});
