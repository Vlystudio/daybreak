"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, securityRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { profileSchema, calendarSyncSchema, type ProfileInput } from "@/lib/validation";
import { geocodeCity } from "@/lib/integrations/weather";
import {
  deleteConnection,
  ProviderRevocationRetryableError,
  revokeProviderConnection,
  type Provider,
} from "@/lib/integrations/tokens";
import { syncOuraForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import type { ActionResult } from "@/actions/schedule";
import {
  AI_CONSENT_VERSION,
  aiConsentFromPrefs,
  type AiConsent,
  type AiConsentPreferences,
} from "@/lib/integrations/ai-consent";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }

  // Resolve city → coordinates/timezone server-side so weather works.
  let location: {
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone?: string;
  } = {
    city: null,
    latitude: null,
    longitude: null,
  };
  if (parsed.data.city) {
    const geo = await geocodeCity(parsed.data.city);
    if (!geo) return { ok: false, error: "We couldn't find that city — try a nearby larger one." };
    location = {
      city: geo.name,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude,
      bio: parsed.data.bio?.length ? parsed.data.bio : null,
      ...(location.timezone ? { timezone: location.timezone } : {}),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Couldn't save your profile." };

  await audit(user.id, "profile.updated");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setCalendarSyncEnabled(input: {
  syncEnabled: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = calendarSyncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_sync_settings")
    .upsert({ user_id: user.id, sync_enabled: parsed.data.syncEnabled }, { onConflict: "user_id" });

  if (error) return { ok: false, error: "Couldn't update calendar sync." };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

const MAX_AVATAR_CHARS = 3_000_000; // ~2MB image as base64

/** Upload a profile picture to the public avatars bucket and save its URL. */
export async function uploadAvatar(input: { imageDataUrl: string }): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const dataUrl = input.imageDataUrl;
  const m =
    typeof dataUrl === "string"
      ? dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      : null;
  if (!m) return { ok: false, error: "That doesn't look like an image." };
  if (dataUrl.length > MAX_AVATAR_CHARS)
    return { ok: false, error: "That image is a bit large — try a smaller one." };

  const bytes = Buffer.from(m[2], "base64");
  const admin = createAdminClient();
  const path = `${user.id}.jpg`;
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { ok: false, error: "Couldn't upload that picture." };

  const publicUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?v=${Date.now()}` }) // cache-bust the stable path
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your picture." };

  await audit(user.id, "profile.updated");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't remove your picture." };
  try {
    await createAdminClient()
      .storage.from("avatars")
      .remove([`${user.id}.jpg`]);
  } catch {
    // best-effort cleanup
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

const ACCENTS = ["sunrise", "coral", "berry", "grape", "ocean", "forest"] as const;

export async function setAccent(accent: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.enum(ACCENTS).safeParse(accent);
  if (!parsed.success) return { ok: false, error: "Unknown theme" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ accent: parsed.data })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your theme." };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setMorningEmailEnabled(input: { enabled: boolean }): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = z.object({ enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_settings")
    .upsert(
      { user_id: user.id, morning_email_enabled: parsed.data.enabled },
      { onConflict: "user_id" }
    );

  if (error) return { ok: false, error: "Couldn't update email settings." };

  revalidatePath("/settings");
  return { ok: true };
}

const AI_CONTEXT_COLUMN = {
  basic: "allow_ai_basic_processing",
  tasks: "allow_ai_tasks_context",
  checkin: "allow_ai_checkin_context",
  health: "allow_ai_health_context",
  calendarAvailability: "allow_ai_calendar_availability",
  calendarDetail: "allow_ai_calendar_detail",
  profile: "allow_ai_profile_context",
  uploads: "allow_ai_uploads",
} as const;

const aiContextSchema = z.object({
  context: z.enum([
    "basic",
    "tasks",
    "checkin",
    "health",
    "calendarAvailability",
    "calendarDetail",
    "profile",
    "uploads",
  ]),
  enabled: z.boolean(),
});

const aiConsentSchema = z
  .object({
    basic: z.boolean(),
    tasks: z.boolean(),
    checkin: z.boolean(),
    health: z.boolean(),
    calendarAvailability: z.boolean(),
    calendarDetail: z.boolean(),
    profile: z.boolean(),
    uploads: z.boolean(),
  })
  .refine((choice) => !choice.calendarDetail || choice.calendarAvailability, {
    message: "Calendar details require calendar availability.",
    path: ["calendarDetail"],
  });

async function persistAiConsent(choice: AiConsent): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_current_user_ai_consent", {
    p_basic: choice.basic,
    p_tasks: choice.tasks,
    p_checkin: choice.checkin,
    p_health: choice.health,
    p_calendar_availability: choice.calendarAvailability,
    p_calendar_detail: choice.calendarDetail,
    p_profile: choice.profile,
    p_uploads: choice.uploads,
    p_consent_version: AI_CONSENT_VERSION,
    p_application_version: "web-0.1.0",
    p_platform: "web",
  });
  return error ? { ok: false, error: "Couldn't save your AI consent choice." } : { ok: true };
}

/** Toggle whether a given context may be sent to the AI processor. */
export async function setAiContextPreference(input: {
  context: string;
  enabled: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await securityRateLimit(`ai-consent:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = aiContextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting" };

  const supabase = await createClient();
  const { data: prefs, error: readError } = await supabase
    .from("user_preferences")
    .select(Object.values(AI_CONTEXT_COLUMN).join(","))
    .eq("user_id", user.id)
    .maybeSingle<AiConsentPreferences>();
  if (readError) return { ok: false, error: "Couldn't update your AI settings." };
  const next = {
    ...aiConsentFromPrefs(prefs),
    [parsed.data.context]: parsed.data.enabled,
  };
  if (parsed.data.context === "calendarAvailability" && !parsed.data.enabled) {
    next.calendarDetail = false;
  }
  if (parsed.data.context === "calendarDetail" && parsed.data.enabled) {
    next.calendarAvailability = true;
  }
  const result = await persistAiConsent(next);
  if (!result.ok) return result;

  await audit(user.id, "ai.consent_updated", {
    metadata: { version: AI_CONSENT_VERSION, category: parsed.data.context },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Record the complete disclosure decision atomically before first AI use. */
export async function setAiConsentPreferences(input: AiConsent): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = aiConsentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid AI consent choice." };

  const limited = await securityRateLimit(`ai-consent:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const result = await persistAiConsent(parsed.data);
  if (!result.ok) return result;

  await audit(user.id, "ai.consent_updated", {
    metadata: { version: AI_CONSENT_VERSION },
  });
  revalidatePath("/onboarding");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

const providerActionSchema = z.enum(["oura", "google", "fitbit"]);

export async function disconnectProvider(providerName: string): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await securityRateLimit(`disconnect:${user.id}`, RATE_LIMITS.disconnect);
  if (!limited.ok) return { ok: false, error: "Too many changes — please try again shortly." };

  const parsed = providerActionSchema.safeParse(providerName);
  if (!parsed.success) return { ok: false, error: "Unknown provider" };

  const provider = parsed.data as Provider;
  try {
    await revokeProviderConnection(user.id, provider);
  } catch (error) {
    if (error instanceof ProviderRevocationRetryableError) {
      return {
        ok: false,
        error:
          "The provider could not confirm revocation yet. Your connection was kept so you can retry.",
      };
    }
    return { ok: false, error: "Couldn't revoke this provider connection." };
  }
  await deleteConnection(user.id, provider);
  await audit(user.id, "connection.unlinked", {
    entity: "oauth_connection",
    metadata: { provider: parsed.data },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

/** Manual "refresh my data" — pulls Oura + Calendar and rebuilds the briefing. */
export async function syncNow(): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`sync:${user.id}`, RATE_LIMITS.sync);
  if (!limited.ok) {
    return {
      ok: false,
      error: "You've refreshed a lot recently — data updates automatically each morning.",
    };
  }

  try {
    const [oura, calendar] = await Promise.all([
      syncOuraForUser(user.id, 7),
      syncCalendarForUser(user.id),
    ]);
    if (oura || calendar) await generateSummaryForUser(user.id);
  } catch (err) {
    safeLog("error", "sync.manual_failed", { errorClass: errorClass(err) });
    return { ok: false, error: "Sync hit a snag — please try again in a minute." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

/** Regenerate today's AI briefing on demand (tightly rate-limited). */
export async function regenerateBriefing(): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Briefing limit reached for now — it refreshes automatically each morning.",
    };
  }

  const generated = await generateSummaryForUser(user.id);
  if (!generated) {
    return {
      ok: false,
      error: "We couldn't generate a briefing — connect Oura or add some schedule data first.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
