"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/actions/schedule";

const COLORS = ["honey", "sage", "sky", "peach"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().max(8).optional(),
  color: z.enum(COLORS).default("honey"),
  targetPerWeek: z.number().int().min(1).max(7).default(7),
});

export async function createHabit(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give your habit a name." };

  const supabase = await createClient();

  // Append to the end of the active list.
  const { count } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null);

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name: parsed.data.name,
    emoji: parsed.data.emoji?.length ? parsed.data.emoji : null,
    color: parsed.data.color,
    target_per_week: parsed.data.targetPerWeek,
    sort_order: count ?? 0,
  });
  if (error) return { ok: false, error: "Couldn't create that habit." };

  await audit(user.id, "habit.created");
  revalidatePath("/dashboard");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().max(8).optional(),
  color: z.enum(COLORS),
  targetPerWeek: z.number().int().min(1).max(7),
});

/** Edit an existing habit's name, emoji, color, and weekly target. */
export async function updateHabit(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those habit details look off." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji?.length ? parsed.data.emoji : null,
      color: parsed.data.color,
      target_per_week: parsed.data.targetPerWeek,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't update that habit." };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mark a habit done/undone for today (toggles the row). */
export async function toggleHabitToday(habitId: string): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  if (!z.string().uuid().safeParse(habitId).success) return { ok: false, error: "Unknown habit" };

  const supabase = await createClient();

  // Ownership is enforced by RLS; confirm the habit exists and get the user's tz.
  const [{ data: habit }, { data: profile }] = await Promise.all([
    supabase.from("habits").select("id").eq("id", habitId).eq("user_id", user.id).maybeSingle<{ id: string }>(),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle<{ timezone: string }>(),
  ]);
  if (!habit) return { ok: false, error: "Unknown habit" };
  const today = localDate(profile?.timezone ?? "UTC");

  const { data: existing } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("date", today)
    .maybeSingle<{ id: string }>();

  if (existing) {
    const { error } = await supabase.from("habit_logs").delete().eq("id", existing.id);
    if (error) return { ok: false, error: "Couldn't update that habit." };
  } else {
    const { error } = await supabase
      .from("habit_logs")
      .insert({ user_id: user.id, habit_id: habitId, date: today });
    if (error) return { ok: false, error: "Couldn't update that habit." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveHabit(habitId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(habitId).success) return { ok: false, error: "Unknown habit" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that habit." };

  revalidatePath("/dashboard");
  return { ok: true };
}

function localDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date()
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
