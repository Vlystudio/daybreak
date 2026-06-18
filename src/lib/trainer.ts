import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFitnessPlan } from "@/lib/integrations/ai";
import { audit } from "@/lib/audit";
import type { UserPreferences } from "@/lib/planning";

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Mifflin-St Jeor BMR -> TDEE -> goal-adjusted calories and macros. */
export function computeTargets(prefs: UserPreferences): MacroTargets | null {
  if (prefs.height_in == null || prefs.weight_lb == null) return null;

  const kg = prefs.weight_lb * 0.453592;
  const cm = prefs.height_in * 2.54;
  const age = prefs.birth_year ? new Date().getFullYear() - prefs.birth_year : 30;

  let bmr: number;
  if (prefs.sex === "male") bmr = 10 * kg + 6.25 * cm - 5 * age + 5;
  else if (prefs.sex === "female") bmr = 10 * kg + 6.25 * cm - 5 * age - 161;
  else bmr = 10 * kg + 6.25 * cm - 5 * age - 78; // neutral midpoint

  const tdee = bmr * (ACTIVITY_MULTIPLIER[prefs.activity_level ?? ""] ?? 1.375);

  let calories = tdee;
  if (prefs.fitness_goal === "weight_loss") calories = tdee - 500;
  else if (prefs.fitness_goal === "muscle_gain") calories = tdee + 300;
  calories = Math.max(1200, Math.round(calories / 10) * 10);

  const lb = prefs.weight_lb;
  const proteinPerLb =
    prefs.fitness_goal === "muscle_gain" || prefs.fitness_goal === "weight_loss" ? 1.0 : 0.8;
  const protein = Math.round(lb * proteinPerLb);
  const fat = Math.round(lb * 0.4);
  const carbs = Math.max(0, Math.round((calories - (protein * 4 + fat * 9)) / 4));

  return { calories, protein, carbs, fat };
}

export type TrainerResult = "ok" | "missing_metrics" | "failed";

export async function generateFitnessPlanForUser(userId: string): Promise<TrainerResult> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserPreferences>();
  if (!prefs) return "missing_metrics";

  const targets = computeTargets(prefs);
  if (!targets) return "missing_metrics";

  const content = await generateFitnessPlan({
    profile: {
      age: prefs.birth_year ? new Date().getFullYear() - prefs.birth_year : null,
      sex: prefs.sex,
      heightIn: prefs.height_in as number,
      weightLb: prefs.weight_lb as number,
      activityLevel: prefs.activity_level,
      goal: prefs.fitness_goal,
      exerciseFrequency: prefs.exercise_frequency,
      dietaryRestrictions: prefs.dietary_restrictions ?? [],
    },
    targets,
  });
  if (!content) return "failed";

  const { error } = await admin.from("fitness_plans").upsert(
    {
      user_id: userId,
      summary: content.summary,
      calorie_target: targets.calories,
      protein_g: targets.protein,
      carbs_g: targets.carbs,
      fat_g: targets.fat,
      workout: content.workout,
      nutrition: content.nutrition,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Failed to store fitness plan: ${error.message}`);

  await audit(userId, "fitness_plan.generated");
  return "ok";
}
