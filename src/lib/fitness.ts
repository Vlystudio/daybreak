import { z } from "zod";

/**
 * Fitness engine types + Zod schemas. The Zod schemas double as OpenAI
 * structured-output schemas (strict JSON), so they avoid optionals — use
 * arrays/booleans/nullable instead. Safe to import from client or server.
 */

export const EXERCISE_CATEGORIES = [
  "strength",
  "cardio",
  "mobility",
  "balance",
  "plyometric",
  "stretch",
] as const;

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "full body",
] as const;

export const EQUIPMENT_OPTIONS = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "resistance band",
  "pull-up bar",
  "bench",
  "yoga mat",
  "cable machine",
  "treadmill",
  "stationary bike",
] as const;

export const WORKOUT_GOALS = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "muscle_gain", label: "Muscle gain" },
  { value: "mobility", label: "Mobility" },
  { value: "general_fitness", label: "General fitness" },
] as const;

// ── Structured-output schemas (strict JSON) ─────────────────────────────────
export const ExerciseSchema = z.object({
  name: z.string(),
  category: z.enum(EXERCISE_CATEGORIES),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()),
  equipment: z.array(z.string()),
  difficulty: z.enum(DIFFICULTIES),
  movement_pattern: z.string(),
  instructions: z.array(z.string()),
  common_mistakes: z.array(z.string()),
  safety_notes: z.array(z.string()),
  contraindications: z.array(z.string()),
  home_friendly: z.boolean(),
  gym_friendly: z.boolean(),
  estimated_duration_minutes: z.number(),
});
export type GeneratedExercise = z.infer<typeof ExerciseSchema>;

export const ExerciseListSchema = z.object({ exercises: z.array(ExerciseSchema) });

export const WorkoutItemSchema = z.object({
  exercise_name: z.string(),
  sets: z.number(),
  reps: z.string(),
  rest_seconds: z.number(),
  notes: z.string(),
});
export type WorkoutItem = z.infer<typeof WorkoutItemSchema>;

export const WorkoutPlanSchema = z.object({
  workout_title: z.string(),
  reasoning_summary: z.string(),
  intensity: z.enum(["low", "moderate", "high"]),
  estimated_duration_minutes: z.number(),
  warmup: z.array(WorkoutItemSchema),
  main_workout: z.array(WorkoutItemSchema),
  cooldown: z.array(WorkoutItemSchema),
  safety_notes: z.array(z.string()),
  progression_next_time: z.array(z.string()),
});
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

// ── DB row types ────────────────────────────────────────────────────────────
export interface Exercise extends GeneratedExercise {
  id: string;
  slug: string;
}

export interface UserWorkout {
  id: string;
  date: string;
  title: string;
  intensity: "low" | "moderate" | "high" | null;
  reasoning_summary: string | null;
  estimated_duration_minutes: number | null;
  plan: WorkoutPlan;
  status: "planned" | "completed" | "skipped";
  created_at: string;
}

export interface WorkoutLogEntry {
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  notes: string | null;
}

/** Normalize an exercise name to a stable slug for dedup. */
export function exerciseSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
