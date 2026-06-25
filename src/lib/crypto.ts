import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { serverEnv } from "@/env";

/**
 * AES-256-GCM encryption for secrets at rest (OAuth tokens), with key
 * versioning so the encryption key can be rotated without downtime.
 *
 * Ciphertext format:
 *   - legacy / default:  base64(iv).base64(tag).base64(ct)
 *   - versioned:         <keyId>.base64(iv).base64(tag).base64(ct)
 *
 * With no rotation configured the active key id is "0" and we emit the legacy
 * 3-part format — byte-identical to before, so deploying this changes nothing.
 * To rotate: add the new key to TOKEN_ENCRYPTION_KEYS (JSON `{ "k1": "<base64>" }`)
 * and set TOKEN_ENCRYPTION_ACTIVE_KEY=k1. Old ciphertext keeps decrypting with
 * its original key, and rows re-encrypt with the active key as they're rewritten
 * (e.g. on the next OAuth token refresh). Key ids must not contain ".".
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const BASE_KEY_ID = "0";

interface Registry {
  activeId: string;
  byId: Map<string, Buffer>;
}

let cached: Registry | null = null;

function registry(): Registry {
  if (cached) return cached;
  const env = serverEnv();
  const byId = new Map<string, Buffer>();
  byId.set(BASE_KEY_ID, Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64"));

  let activeId = BASE_KEY_ID;
  if (env.TOKEN_ENCRYPTION_KEYS) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(env.TOKEN_ENCRYPTION_KEYS) as Record<string, string>;
    } catch {
      throw new Error("TOKEN_ENCRYPTION_KEYS must be JSON of { keyId: base64Key }");
    }
    for (const [id, b64] of Object.entries(parsed)) {
      if (id === BASE_KEY_ID) continue; // reserved for the base key
      const buf = Buffer.from(b64, "base64");
      if (buf.length !== 32)
        throw new Error(`TOKEN_ENCRYPTION_KEYS["${id}"] must be 32 bytes, base64`);
      byId.set(id, buf);
    }
    const want = env.TOKEN_ENCRYPTION_ACTIVE_KEY;
    if (want) {
      if (!byId.has(want))
        throw new Error(`TOKEN_ENCRYPTION_ACTIVE_KEY "${want}" not found in keys`);
      activeId = want;
    }
  }

  cached = { activeId, byId };
  return cached;
}

/** Base key — used for HMAC-signed OAuth state, kept stable across rotations. */
function baseKey(): Buffer {
  return registry().byId.get(BASE_KEY_ID)!;
}

export function encryptToken(plaintext: string): string {
  const { activeId, byId } = registry();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, byId.get(activeId)!, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const core = [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    "."
  );
  // The default key emits the legacy format, so this is a no-op until you rotate.
  return activeId === BASE_KEY_ID ? core : `${activeId}.${core}`;
}

export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  let keyId = BASE_KEY_ID;
  let ivB64: string;
  let tagB64: string;
  let dataB64: string;
  if (parts.length === 4) {
    [keyId, ivB64, tagB64, dataB64] = parts;
  } else if (parts.length === 3) {
    [ivB64, tagB64, dataB64] = parts;
  } else {
    throw new Error("Malformed encrypted token payload");
  }

  const k = registry().byId.get(keyId);
  if (!k) throw new Error(`Unknown encryption key id "${keyId}"`);
  const decipher = createDecipheriv(ALGO, k, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** HMAC-signed value for OAuth `state` (CSRF protection on callback). */
export function signState(value: string): string {
  const sig = createHmac("sha256", baseKey()).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function verifyState(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = createHmac("sha256", baseKey()).update(value).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
