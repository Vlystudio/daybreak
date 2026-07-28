/**
 * Central structured logger. Metadata is allow-small and deny-sensitive: raw
 * Error objects, identifiers, contact data, health values, prompts, responses,
 * calendar/check-in text, credentials, and deletion/minor records are redacted.
 */

export type SafeLogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY =
  /(?:^|_)(?:user|account|subject|email|name|address|location|latitude|longitude|health|wellness|medical|sleep|hrv|heart|weight|body|checkin|calendar|title|description|prompt|response|content|message|note|token|secret|password|authorization|cookie|permit|photo|image|deletion|minor|underage)(?:_|$)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function safeString(value: string): string {
  return value
    .replace(EMAIL, "[email]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(JWT, "[token]")
    .replace(UUID, "[id]")
    .slice(0, 160);
}

function safeValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (value instanceof Error) return { errorClass: value.name || "Error" };
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return safeString(value);
  if (depth >= 2) return "[truncated]";
  if (Array.isArray(value))
    return value.slice(0, 10).map((item) => safeValue("item", item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([childKey, childValue]) => [childKey, safeValue(childKey, childValue, depth + 1)])
    );
  }
  return typeof value;
}

export function safeLog(
  level: SafeLogLevel,
  event: string,
  metadata: Record<string, unknown> = {}
): void {
  const safeEvent = event.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80) || "unknown";
  const record = JSON.stringify({
    level,
    event: safeEvent,
    ...Object.fromEntries(
      Object.entries(metadata)
        .slice(0, 20)
        .map(([key, value]) => [key, safeValue(key, value)])
    ),
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function errorClass(reason: unknown): string {
  return reason instanceof Error ? reason.name || "Error" : "unknown";
}
