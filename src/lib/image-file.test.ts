import { describe, expect, it } from "vitest";
import { MAX_SOURCE_IMAGE_BYTES, validateImageFileMetadata } from "@/lib/image-file";

describe("source image validation", () => {
  it("accepts supported bounded images", () => {
    expect(validateImageFileMetadata({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
    expect(validateImageFileMetadata({ type: "image/heic", size: 1024 })).toEqual({ ok: true });
  });

  it("rejects invalid, empty, and oversized files", () => {
    expect(validateImageFileMetadata({ type: "application/pdf", size: 1024 }).ok).toBe(false);
    expect(validateImageFileMetadata({ type: "image/png", size: 0 }).ok).toBe(false);
    expect(
      validateImageFileMetadata({ type: "image/png", size: MAX_SOURCE_IMAGE_BYTES + 1 }).ok
    ).toBe(false);
  });
});
