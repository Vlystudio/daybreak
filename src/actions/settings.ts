"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { profileSchema, calendarSyncSchema, type ProfileInput } from "@/lib/validation";
import { geocodeCity } from "@/lib/integrations/weather";
import { deleteConnection, type Provider } from "@/lib/integrations/tokens";
import { syncOuraForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import type { ActionResult } from "@/actions/schedule";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }

  // Resolve city → coordinates/timezone server-side so weather works.
  let location: { city: string | null; latitude: number | null; longitude: number | null; timezone?: string } = {
    city: null,
    latitude: null,
    longitude: null,
  };
  if (parsed.data.city) {
    const geo = await geocodeCity(parsed.data.city);
    if (!geo) return { ok: false, error: "We couldn't find that city — try a nearby larger one." };
    location = { city: geo.name, latitude: geo.latitude, longitude: geo.longitude, timezone: geo.timezone };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude,
      ...(location.timezone ? { timezone: location.timezone } : {}),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Couldn't save your profile." };

  await audit(user.id, "profile.updated");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setCalendarSyncEnabled(input: { syncEnabled: boolean }): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = calendarSyncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting" };

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_sync_settings").upsert(
    { user_id: user.id, sync_enabled: parsed.data.syncEnabled },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: "Couldn't update calendar sync." };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setMorningEmailEnabled(input: { enabled: boolean }): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = z.object({ enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting" };

  const supabase = await createClient();
  const { error } = await supabase.from("notification_settings").upsert(
    { user_id: user.id, morning_email_enabled: parsed.data.enabled },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: "Couldn't update email settings." };

  revalidatePath("/settings");
  return { ok: true };
}

const providerActionSchema = z.enum(["oura", "google", "fitbit"]);

export async function disconnectProvider(provider: string): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = providerActionSchema.safeParse(provider);
  if (!parsed.success) return { ok: false, error: "Unknown provider" };

  await deleteConnection(user.id, parsed.data as Provider);
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
    return { ok: false, error: "You've refreshed a lot recently — data updates automatically each morning." };
  }

  try {
    const [oura, calendar] = await Promise.all([
      syncOuraForUser(user.id, 7),
      syncCalendarForUser(user.id),
    ]);
    if (oura || calendar) await generateSummaryForUser(user.id);
  } catch (err) {
    console.error("[sync] manual sync failed:", err);
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
    return { ok: false, error: "Briefing limit reached for now — it refreshes automatically each morning." };
  }

  const generated = await generateSummaryForUser(user.id);
  if (!generated) {
    return { ok: false, error: "We couldn't generate a briefing — connect Oura or add some schedule data first." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
