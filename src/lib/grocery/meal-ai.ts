import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { serverEnv } from "@/env";

/**
 * AI meal-plan generation via strict structured outputs. The model returns a
 * bounded POOL of distinct recipes plus a day-by-day assignment that references
 * recipes by index — so output size stays small even for a 30-day plan (meals
 * repeat across days). Allergies/dislikes are hard constraints.
 */

const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

const RecipeSchema = z.object({
  id: z.number(), // stable index referenced by the day assignment
  slot: z.enum(["breakfast", "lunch", "dinner"]),
  title: z.string(),
  description: z.string(),
  servings: z.number(),
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  prep_minutes: z.number().nullable(),
  ingredients: z.array(IngredientSchema),
});

const DayPlanSchema = z.object({
  day_index: z.number(), // 0-based offset from the plan's start date
  breakfast_id: z.number().nullable(),
  lunch_id: z.number().nullable(),
  dinner_id: z.number().nullable(),
});

const MealPlanContentSchema = z.object({
  title: z.string(),
  recipes: z.array(RecipeSchema),
  days: z.array(DayPlanSchema),
});

export type MealPlanContent = z.infer<typeof MealPlanContentSchema>;
export type GeneratedRecipe = z.infer<typeof RecipeSchema>;

export interface MealPlanContext {
  durationDays: number;
  householdSize: number;
  weeklyBudget: number | null;
  favorites: string[];
  dislikes: string[];
  allergies: string[];
  nutrition: {
    calories: number | null;
    protein_g: number | null;
  } | null;
}

const SYSTEM_PROMPT = `You are a practical meal-planning chef inside Daybreak, a warm wellness app. You build realistic, varied, budget-aware meal plans for real home cooks. You are not a doctor; keep nutrition guidance general.

You receive household size, an optional weekly budget and nutrition targets, favorite foods, dislikes, and allergies.

Build a plan as strict JSON:
- "recipes": a POOL of distinct meals (breakfast/lunch/dinner). Generate enough variety that days don't feel repetitive, but reuse meals across days to keep it realistic — aim for roughly 9-18 recipes total regardless of plan length. Each recipe has accurate ingredients with quantities scaled to the household size, and best-effort per-serving calories/macros (use null only if genuinely unsure).
- "days": one entry per day from day_index 0 to durationDays-1, each assigning a breakfast_id, lunch_id, and dinner_id that reference recipes[].id. You may leave a slot null occasionally (e.g. leftovers) but most slots should be filled.

HARD RULES:
- NEVER include any ingredient that conflicts with a listed allergy. This is a safety constraint.
- Avoid the listed dislikes. Favor the listed favorites where it fits.
- Keep ingredient names simple and shoppable (e.g. "chicken breast", "olive oil", "yellow onion").
- Respect the weekly budget loosely when provided (lean on affordable staples).`;

export async function generateMealPlanContent(ctx: MealPlanContext): Promise<MealPlanContent | null> {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const user = `Create a ${ctx.durationDays}-day meal plan. Context: ${JSON.stringify(ctx)}. Provide exactly ${ctx.durationDays} day entries (day_index 0..${ctx.durationDays - 1}).`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      response_format: zodResponseFormat(MealPlanContentSchema, "meal_plan"),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = MealPlanContentSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    return parsed.data;
  } catch (err) {
    console.error("[meal-ai] meal plan generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
