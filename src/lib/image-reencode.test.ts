import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImageReencodeError,
  boundedImageDimensions,
  reencodeImageFile,
} from "@/lib/image-reencode";

class FakeImage {
  static next: "load" | "error" = "load";
  width = 4000;
  height = 2000;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => (FakeImage.next === "load" ? this.onload?.() : this.onerror?.()));
  }
}

describe("image picker re-encoding", () => {
  const drawImage = vi.fn();
  const revokeObjectURL = vi.fn();
  const getContext = vi.fn<() => { drawImage: typeof drawImage } | null>(() => ({ drawImage }));
  const canvas = {
    width: 0,
    height: 0,
    getContext,
    toDataURL: vi.fn(() => "data:image/jpeg;base64,bounded"),
  };

  beforeEach(() => {
    FakeImage.next = "load";
    drawImage.mockClear();
    revokeObjectURL.mockClear();
    canvas.width = 0;
    canvas.height = 0;
    getContext.mockReturnValue({ drawImage });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:chosen-photo"),
      revokeObjectURL,
    });
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("successfully bounds and JPEG re-encodes a large image, stripping source metadata", async () => {
    await expect(
      reencodeImageFile(new Blob(["source-with-exif"]), { maxDim: 1000, quality: 0.7 })
    ).resolves.toBe("data:image/jpeg;base64,bounded");
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("rejects an image decode failure and always revokes the object URL", async () => {
    FakeImage.next = "error";
    await expect(reencodeImageFile(new Blob(["bad"]))).rejects.toBeInstanceOf(ImageReencodeError);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("cleans up after a canvas failure", async () => {
    getContext.mockReturnValueOnce(null);
    await expect(reencodeImageFile(new Blob(["image"]))).rejects.toBeInstanceOf(ImageReencodeError);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("computes bounded dimensions and rejects invalid decoded dimensions", () => {
    expect(boundedImageDimensions(6000, 4000, 1200)).toEqual({ width: 1200, height: 800 });
    expect(() => boundedImageDimensions(0, 100, 1200)).toThrow(ImageReencodeError);
  });
});
