"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import {
  generateExercises,
  generateWorkoutPlan,
  type ExerciseFilters,
  type WorkoutContext,
} from "@/lib/integrations/fitness-ai";
import { detectRedFlags, redFlagGuidance } from "@/lib/fitness-safety";
import { exerciseSlug, type Exercise, type UserWorkout, type WorkoutLogEntry } from "@/lib/fitness";
import type { ActionResult } from "@/actions/schedule";

// ── Equipment & limitations ─────────────────────────────────────────────────
export async function addEquipment(name: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.string().trim().min(1).max(60).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Enter a valid item." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_equipment")
    .insert({ user_id: user.id, name: parsed.data });
  if (error) return { ok: false, error: "Couldn't add that (maybe already on your list)." };

  revalidatePath("/coach");
  return { ok: true };
}

export async function removeEquipment(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("user_equipment").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that." };
  revalidatePath("/coach");
  return { ok: true };
}

export async function addLimitation(description: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.string().trim().min(1).max(200).safeParse(description);
  if (!parsed.success) return { ok: false, error: "Enter a valid limitation." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_limitations")
    .insert({ user_id: user.id, description: parsed.data });
  if (error) return { ok: false, error: "Couldn't add that." };
  revalidatePath("/coach");
  return { ok: true };
}

export async function removeLimitation(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("user_limitations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that." };
  revalidatePath("/coach");
  return { ok: true };
}

// ── Exercise search (cache-or-generate) ─────────────────────────────────────
export type ExerciseSearchResult =
  | { ok: true; exercises: Exercise[]; generated: boolean }
  | { ok: false; error: string };

export async function searchExercises(filters: ExerciseFilters): Promise<ExerciseSearchResult> {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase.from("exercises").select("*").limit(48);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.workoutType) query = query.eq("category", filters.workoutType);
  if (filters.location === "home") query = query.eq("home_friendly", true);
  if (filters.location === "gym") query = query.eq("gym_friendly", true);
  if (filters.muscleGroup) query = query.contains("primary_muscles", [filters.muscleGroup]);

  const { data: libraryRaw } = await query.returns<Exercise[]>();
  let library = libraryRaw ?? [];

  // Equipment filter in JS (any overlap, or bodyweight always allowed).
  if (filters.equipment && filters.equipment.length > 0) {
    const want = new Set(filters.equipment.map((e) => e.toLowerCase()));
    library = library.filter((e) =>
      e.equipment.some((eq) => want.has(eq.toLowerCase()) || eq.toLowerCase() === "bodyweight")
    );
  }

  if (library.length >= 6) {
    return { ok: true, exercises: library.slice(0, 24), generated: false };
  }

  // Not enough — generate, validate, store, return.
  const limited = await rateLimit(`fitness:${user.id}`, RATE_LIMITS.aiFitness);
  if (!limited.ok) {
    return library.length > 0
      ? { ok: true, exercises: library, generated: false }
      : { ok: false, error: "Daily generation limit reached — try again tomorrow." };
  }

  const generated = await generateExercises(filters, 8);
  if (!generated) {
    return library.length > 0
      ? { ok: true, exercises: library, generated: false }
      : { ok: false, error: "Couldn't generate exercises right now — please try again." };
  }

  const admin = createAdminClient();
  const rows = generated.map((e) => ({
    slug: exerciseSlug(e.name),
    name: e.name,
    category: e.category,
    primary_muscles: e.primary_muscles,
    secondary_muscles: e.secondary_muscles,
    equipment: e.equipment,
    difficulty: e.difficulty,
    movement_pattern: e.movement_pattern,
    instructions: e.instructions,
    common_mistakes: e.common_mistakes,
    safety_notes: e.safety_notes,
    contraindications: e.contraindications,
    home_friendly: e.home_friendly,
    gym_friendly: e.gym_friendly,
    estimated_duration_minutes: e.estimated_duration_minutes,
  }));
  await admin.from("exercises").upsert(rows, { onConflict: "slug" });
  await audit(user.id, "exercises.generated", { metadata: { count: rows.length } });

  const { data: stored } = await admin
    .from("exercises")
    .select("*")
    .in(
      "slug",
      rows.map((r) => r.slug)
    )
    .returns<Exercise[]>();

  const byId = new Map<string, Exercise>();
  for (const e of [...library, ...(stored ?? [])]) byId.set(e.id, e);
  return { ok: true, exercises: Array.from(byId.values()).slice(0, 24), generated: true };
}

// ── Workout generation (safety-gated) ───────────────────────────────────────
export type WorkoutResult =
  | { ok: true; workout: UserWorkout }
  | { ok: false; blocked: true; message: string }
  | { ok: false; error: string };

export async function generateWorkout(input: {
  timeAvailableMinutes?: number;
  soreness?: string;
}): Promise<WorkoutResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: prefs }, { data: equip }, { data: lims }, { data: metric }, { data: recent }] =
    await Promise.all([
      supabase
        .from("user_preferences")
        .select("fitness_goal, activity_level, exercise_frequency")
        .eq("user_id", user.id)
        .maybeSingle<{ fitness_goal: string | null; activity_level: string | null; exercise_frequency: string | null }>(),
      supabase.from("user_equipment").select("name").eq("user_id", user.id).returns<{ name: string }[]>(),
      supabase
        .from("user_limitations")
        .select("description")
        .eq("user_id", user.id)
        .returns<{ description: string }[]>(),
      supabase
        .from("health_metrics")
        .select("sleep_duration_min, hrv_avg, resting_hr, readiness_score")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle<{
          sleep_duration_min: number | null;
          hrv_avg: number | null;
          resting_hr: number | null;
          readiness_score: number | null;
        }>(),
      supabase
        .from("user_workouts")
        .select("date, title, intensity")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5)
        .returns<{ date: string; title: string; intensity: string | null }[]>(),
    ]);

  const limitations = (lims ?? []).map((l) => l.description);
  const soreness = input.soreness?.trim() || null;

  // SAFETY: block on red-flag symptoms before spending an OpenAI call.
  const flags = detectRedFlags([soreness, ...limitations].filter(Boolean).join(". "));
  if (flags.length > 0) return { ok: false, blocked: true, message: redFlagGuidance(flags) };

  const limited = await rateLimit(`fitness:${user.id}`, RATE_LIMITS.aiFitness);
  if (!limited.ok) return { ok: false, error: "Daily generation limit reached — try again tomorrow." };

  const ctx: WorkoutContext = {
    goal: prefs?.fitness_goal ?? null,
    fitnessLevel: prefs?.activity_level ?? null,
    timeAvailableMinutes: input.timeAvailableMinutes && input.timeAvailableMinutes > 0 ? input.timeAvailableMinutes : 40,
    equipment: (equip ?? []).map((e) => e.name),
    limitations,
    recovery: metric
      ? {
          sleepHours: metric.sleep_duration_min != null ? Math.round((metric.sleep_duration_min / 60) * 10) / 10 : null,
          hrv: metric.hrv_avg,
          restingHeartRate: metric.resting_hr,
          readiness: metric.readiness_score,
          steps: null,
        }
      : null,
    recentWorkouts: (recent ?? []).map((w) => ({ date: w.date, title: w.title, intensity: w.intensity })),
    soreness,
  };

  const plan = await generateWorkoutPlan(ctx);
  if (!plan) return { ok: false, error: "Couldn't build a workout right now — please try again." };

  const { data: stored, error } = await supabase
    .from("user_workouts")
    .insert({
      user_id: user.id,
      title: plan.workout_title,
      intensity: plan.intensity,
      reasoning_summary: plan.reasoning_summary,
      estimated_duration_minutes: plan.estimated_duration_minutes,
      plan,
      status: "planned",
    })
    .select("*")
    .single<UserWorkout>();
  if (error || !stored) return { ok: false, error: "Couldn't save the workout." };

  await audit(user.id, "workout.generated");
  revalidatePath("/coach");
  return { ok: true, workout: stored };
}

// ── Logging ─────────────────────────────────────────────────────────────────
export async function logWorkout(input: {
  workoutId: string;
  entries: WorkoutLogEntry[];
  perceivedEffort?: number;
  notes?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(input.workoutId).success) return { ok: false, error: "Invalid workout" };

  const supabase = await createClient();
  const { error } = await supabase.from("user_workout_logs").insert({
    user_id: user.id,
    workout_id: input.workoutId,
    entries: input.entries ?? [],
    perceived_effort:
      input.perceivedEffort && input.perceivedEffort >= 1 && input.perceivedEffort <= 10
        ? input.perceivedEffort
        : null,
    notes: input.notes?.slice(0, 1000) || null,
  });
  if (error) return { ok: false, error: "Couldn't save your log." };

  await supabase.from("user_workouts").update({ status: "completed" }).eq("id", input.workoutId).eq("user_id", user.id);
  await audit(user.id, "workout.logged");
  revalidatePath("/coach");
  return { ok: true };
}
