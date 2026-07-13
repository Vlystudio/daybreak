export interface ImageReencodeOptions {
  maxDim?: number;
  quality?: number;
  squareSize?: number;
}

export class ImageReencodeError extends Error {
  constructor(message = "That image could not be decoded.") {
    super(message);
    this.name = "ImageReencodeError";
  }
}

export function boundedImageDimensions(
  width: number,
  height: number,
  maxDim: number
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ImageReencodeError();
  }
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Decode, dimension-bound, and re-encode a chosen image as JPEG. Canvas output
 * intentionally drops source EXIF/GPS metadata. The object URL is revoked on
 * success, decode failure, canvas failure, and synchronous setup failure.
 */
export function reencodeImageFile(
  source: Blob,
  { maxDim = 1280, quality = 0.8, squareSize }: ImageReencodeOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(source);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(objectUrl);
    };
    const fail = (error?: unknown) => {
      cleanup();
      reject(error instanceof ImageReencodeError ? error : new ImageReencodeError());
    };

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new ImageReencodeError("This browser could not process the image.");

        if (squareSize != null) {
          if (!Number.isFinite(squareSize) || squareSize <= 0) throw new ImageReencodeError();
          const side = Math.min(image.width, image.height);
          if (side <= 0) throw new ImageReencodeError();
          canvas.width = Math.round(squareSize);
          canvas.height = Math.round(squareSize);
          context.drawImage(
            image,
            (image.width - side) / 2,
            (image.height - side) / 2,
            side,
            side,
            0,
            0,
            canvas.width,
            canvas.height
          );
        } else {
          const size = boundedImageDimensions(image.width, image.height, maxDim);
          canvas.width = size.width;
          canvas.height = size.height;
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (!dataUrl.startsWith("data:image/jpeg")) throw new ImageReencodeError();
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        fail(error);
      }
    };
    image.onerror = () => fail();

    try {
      image.src = objectUrl;
    } catch (error) {
      fail(error);
    }
  });
}
