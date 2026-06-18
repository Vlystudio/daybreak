import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { serverEnv } from "@/env";
import {
  ExerciseListSchema,
  WorkoutPlanSchema,
  type GeneratedExercise,
  type WorkoutPlan,
} from "@/lib/fitness";
import { SAFETY_SYSTEM_RULES } from "@/lib/fitness-safety";

/**
 * OpenAI as the "coach". Uses strict structured outputs (json_schema via Zod)
 * so responses are always valid JSON in our shape — never loose text.
 * Cheaper model for exercise generation; stronger model for workout planning.
 */

const MODEL_FAST = "gpt-4o-mini";
const MODEL_STRONG = "gpt-4o";

function client(): OpenAI | null {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export interface ExerciseFilters {
  muscleGroup?: string;
  equipment?: string[];
  goal?: string;
  difficulty?: string;
  workoutType?: string;
  location?: "home" | "gym" | "any";
  timeAvailableMinutes?: number;
  limitations?: string[];
}

export async function generateExercises(
  filters: ExerciseFilters,
  count = 8
): Promise<GeneratedExercise[] | null> {
  const ai = client();
  if (!ai) return null;

  const system = `You are an expert exercise physiologist building a structured exercise library for a personal fitness app. Generate accurate, real exercises with correct muscle targeting and safe technique. ${SAFETY_SYSTEM_RULES}`;
  const user = `Generate ${count} distinct exercises matching these constraints (omit constraints that are empty): ${JSON.stringify(
    filters
  )}. Each exercise must respect any limitations listed. Fill every field accurately; instructions should be clear step-by-step cues.`;

  try {
    const completion = await ai.chat.completions.create({
      model: MODEL_FAST,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: zodResponseFormat(ExerciseListSchema, "exercise_list"),
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = ExerciseListSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    return parsed.data.exercises;
  } catch (err) {
    console.error("[fitness-ai] exercise generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

export interface WorkoutContext {
  goal: string | null;
  fitnessLevel: string | null;
  timeAvailableMinutes: number;
  equipment: string[];
  limitations: string[];
  recovery: {
    sleepHours: number | null;
    hrv: number | null;
    restingHeartRate: number | null;
    readiness: number | null;
    steps: number | null;
  } | null;
  recentWorkouts: { date: string; title: string; intensity: string | null }[];
  soreness: string | null;
}

export async function generateWorkoutPlan(ctx: WorkoutContext): Promise<WorkoutPlan | null> {
  const ai = client();
  if (!ai) return null;

  const system = `You are an intelligent strength & conditioning coach generating a single session for a personal fitness app. Use the person's recovery data to set intensity: low sleep / low HRV / low readiness means a lighter, recovery-oriented session (mobility, light cardio) rather than heavy lifting; good recovery means you can push appropriately. Apply progressive overload using recent workouts: increase reps before load, avoid spiking volume, alternate emphasis, and deload when recovery is poor. Only use the available equipment. ${SAFETY_SYSTEM_RULES}`;
  const user = `Build one workout for this person as strict JSON. Context: ${JSON.stringify(ctx)}. The reasoning_summary must briefly explain why this intensity/structure fits their recovery and goal. Keep total time within the available minutes.`;

  try {
    const completion = await ai.chat.completions.create({
      model: MODEL_STRONG,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: zodResponseFormat(WorkoutPlanSchema, "workout_plan"),
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = WorkoutPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    return parsed.data;
  } catch (err) {
    console.error("[fitness-ai] workout generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
