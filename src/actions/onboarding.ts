"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";

export async function saveOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your answers." };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      work_type: d.workType,
      work_title: d.workTitle || null,
      work_schedule: d.workSchedule || null,
      work_start_time: d.workStartTime || null,
      work_end_time: d.workEndTime || null,
      work_days: d.workDays,
      fitness_goal: d.fitnessGoal,
      activity_level: d.activityLevel,
      exercise_frequency: d.exerciseFrequency,
      height_in: d.heightIn ?? null,
      weight_lb: d.weightLb ?? null,
      sex: d.sex ?? null,
      birth_year: d.birthYear ?? null,
      hobbies: d.hobbies,
      social_tendency: d.socialTendency,
      chores: d.chores,
      dietary_restrictions: d.dietaryRestrictions,
      dietary_notes: d.dietaryNotes || null,
      planning_scope: d.planningScope,
      onboarding_completed: true,
    },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: "Couldn't save your preferences. Please try again." };

  await audit(user.id, "preferences.updated");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { ok: true };
}
