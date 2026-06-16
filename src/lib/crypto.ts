import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { serverEnv } from "@/env";

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Output format: base64(iv) . base64(authTag) . base64(ciphertext)
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function key(): Buffer {
  return Buffer.from(serverEnv().TOKEN_ENCRYPTION_KEY, "base64");
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted token payload");
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** HMAC-signed value for OAuth `state` (CSRF protection on callback). */
export function signState(value: string): string {
  const sig = createHmac("sha256", key()).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function verifyState(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = createHmac("sha256", key()).update(value).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
