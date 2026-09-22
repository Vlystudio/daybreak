import "server-only";
import registry from "../../../config/privacy/analytics-events.json";
import { createAdminClient } from "@/lib/supabase/admin";

type EventName = (typeof registry.events)[number]["name"];
const FORBIDDEN = new RegExp(registry.forbiddenKeyPattern, "i");

export function validateAnalyticsEvent(
  event: string,
  metadata: Record<string, unknown>
): { ok: true; metadata: Record<string, string | number | boolean> } | { ok: false } {
  const definition = registry.events.find((candidate) => candidate.name === event);
  if (!definition) return { ok: false };
  const allowed = new Set<string>(definition.allowedMetadataKeys);
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key) || FORBIDDEN.test(key)) return { ok: false };
    if (!(["string", "number", "boolean"] as string[]).includes(typeof value)) return { ok: false };
    if (typeof value === "string") {
      if (value.length > 80 || FORBIDDEN.test(value)) return { ok: false };
      output[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }
  return { ok: true, metadata: output };
}

export async function recordAnalyticsEvent(
  userId: string,
  event: EventName,
  metadata: Record<string, unknown>
): Promise<boolean> {
  const validated = validateAnalyticsEvent(event, metadata);
  if (!validated.ok) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("analytics_events").insert({
    user_id: userId,
    type: event,
    metadata: validated.metadata,
  });
  return !error;
}
