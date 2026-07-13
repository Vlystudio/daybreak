export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
export const ACCEPTED_SOURCE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export type ImageFileMetadata = Pick<File, "type" | "size">;

export function validateImageFileMetadata(
  file: ImageFileMetadata
): { ok: true } | { ok: false; error: string } {
  if (!ACCEPTED_SOURCE_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: "Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image." };
  }
  if (file.size <= 0) return { ok: false, error: "That image is empty." };
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return { ok: false, error: "That image is too large. Choose one under 12 MB." };
  }
  return { ok: true };
}
