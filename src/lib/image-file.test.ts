import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_IMAGE_BYTES,
  consumeSelectedImageFile,
  validateImageFileMetadata,
} from "@/lib/image-file";

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

  it("handles picker cancellation and an empty FileList while resetting the input", () => {
    const cancelled = { files: null, value: "unchanged" };
    expect(consumeSelectedImageFile(cancelled)).toBeNull();
    expect(cancelled.value).toBe("");

    const empty = { files: [] as unknown as File[], value: "unchanged" };
    expect(consumeSelectedImageFile(empty)).toBeNull();
    expect(empty.value).toBe("");
  });

  it("preserves an ordinary file selection and allows the same photo to be selected twice", () => {
    const file = { type: "image/jpeg", size: 100 } as File;
    const input = { files: [file], value: "C:\\fakepath\\photo.jpg" };
    expect(consumeSelectedImageFile(input)).toBe(file);
    expect(input.value).toBe("");

    input.files = [file];
    input.value = "C:\\fakepath\\photo.jpg";
    expect(consumeSelectedImageFile(input)).toBe(file);
    expect(input.value).toBe("");
  });
});
