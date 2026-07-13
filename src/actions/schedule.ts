"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { scheduleEventSchema, uuidSchema, type ScheduleEventInput } from "@/lib/validation";
import { SOCIAL_FEATURES_ENABLED } from "@/lib/features";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Schedule mutations. Identity always comes from the session (requireUser);
 * queries are scoped by user_id AND enforced again by RLS. household_id is
 * looked up server-side, never accepted from the client.
 */

async function userHouseholdId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle<{ household_id: string }>();
  return data?.household_id ?? null;
}

export async function createScheduleEvent(input: ScheduleEventInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment — too many changes at once." };

  const parsed = scheduleEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid event" };
  }
  const v = parsed.data;

  const householdId =
    SOCIAL_FEATURES_ENABLED && v.shareWithHousehold ? await userHouseholdId(user.id) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .insert({
      user_id: user.id,
      household_id: householdId,
      title: v.title,
      description: v.description || null,
      location: v.location || null,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      all_day: v.allDay,
      color: v.color,
      source: "manual",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { ok: false, error: "Couldn't save the event. Please try again." };

  await audit(user.id, "schedule.created", { entity: "schedule_event", entityId: data.id });
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function toggleEventCompleted(
  eventId: string,
  completed: boolean
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(eventId).success) return { ok: false, error: "Invalid event" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_events")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Couldn't update that." };

  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function updateScheduleEvent(
  eventId: string,
  input: ScheduleEventInput
): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment — too many changes at once." };

  const idParsed = uuidSchema.safeParse(eventId);
  const parsed = scheduleEventSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return {
      ok: false,
      error: parsed.success
        ? "Invalid event id"
        : (parsed.error.issues[0]?.message ?? "Invalid event"),
    };
  }
  const v = parsed.data;

  const householdId =
    SOCIAL_FEATURES_ENABLED && v.shareWithHousehold ? await userHouseholdId(user.id) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .update({
      title: v.title,
      description: v.description || null,
      location: v.location || null,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      all_day: v.allDay,
      color: v.color,
      household_id: householdId,
    })
    .eq("id", idParsed.data)
    .eq("user_id", user.id) // ownership check (also enforced by RLS)
    .select("id");

  if (error || !data?.length) return { ok: false, error: "Couldn't update the event." };

  await audit(user.id, "schedule.updated", { entity: "schedule_event", entityId: idParsed.data });
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteScheduleEvent(eventId: string): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment — too many changes at once." };

  const idParsed = uuidSchema.safeParse(eventId);
  if (!idParsed.success) return { ok: false, error: "Invalid event id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) return { ok: false, error: "Couldn't delete the event." };

  await audit(user.id, "schedule.deleted", { entity: "schedule_event", entityId: idParsed.data });
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}
