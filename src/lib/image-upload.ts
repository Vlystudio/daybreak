import "server-only";

/**
 * Server-side validation for user-uploaded image data URLs.
 *
 * Goes well beyond a `data:image/` prefix check: it caps the raw payload before
 * decoding, confirms the declared MIME is one we accept, enforces a decoded-size
 * limit, and verifies the actual bytes start with that format's magic number —
 * so a renamed/forged file, a disguised payload, or an oversized upload is
 * rejected before it ever reaches an AI provider.
 *
 * Note: stripping EXIF/GPS metadata happens client-side (the upload widgets
 * re-encode through a canvas, which drops metadata). This layer is the
 * server-side gate that doesn't trust the client.
 */

export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB decoded

export type ImageValidation =
  | { ok: true; mime: string; bytes: number }
  | { ok: false; error: string };

const MAGIC: { mime: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: "image/jpeg",
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  { mime: "image/gif", test: (b) => b.length > 5 && b.toString("ascii", 0, 3) === "GIF" },
];

export function validateImageDataUrl(
  dataUrl: unknown,
  maxBytes: number = DEFAULT_MAX_IMAGE_BYTES
): ImageValidation {
  if (typeof dataUrl !== "string") return { ok: false, error: "That doesn't look like an image." };

  // Bound the raw string before any decode, so a giant payload can't force a
  // huge base64 allocation (~4/3 chars per byte, plus header slack).
  if (dataUrl.length > Math.ceil(maxBytes * (4 / 3)) + 256) {
    return { ok: false, error: "That image is a bit large — try a smaller photo." };
  }

  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!m) return { ok: false, error: "That doesn't look like an image." };
  const declaredMime = m[1].toLowerCase();

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return { ok: false, error: "That image couldn't be read." };
  }
  if (buf.length === 0) return { ok: false, error: "That image is empty." };
  if (buf.length > maxBytes) {
    return { ok: false, error: "That image is a bit large — try a smaller photo." };
  }

  const match = MAGIC.find((fmt) => fmt.test(buf));
  if (!match) return { ok: false, error: "That file isn't a supported image." };
  // The declared type must agree with the real bytes — no forged headers.
  if (declaredMime !== match.mime) {
    return { ok: false, error: "That image type doesn't match its contents." };
  }

  return { ok: true, mime: match.mime, bytes: buf.length };
}
