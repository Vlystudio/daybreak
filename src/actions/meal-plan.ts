"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import {
  mealPlanInputSchema,
  normalizeIngredientName,
  type MealPlanInput,
  type MealPlanDayMeal,
} from "@/lib/grocery";
import { generateMealPlanContent } from "@/lib/grocery/meal-ai";
import { getOnSaleItems } from "@/lib/grocery/on-sale";
import type { ActionResult } from "@/actions/schedule";

type IdResult = { ok: true; id: string } | { ok: false; error: string };

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function householdId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle<{ household_id: string }>();
  return data?.household_id ?? null;
}

interface SettingsRow {
  household_size: number;
  weekly_budget: number | null;
  favorites: string[];
  dislikes: string[];
  allergies: string[];
}

export async function generateMealPlan(input: MealPlanInput): Promise<IdResult> {
  const user = await requireUser();
  const limited = await rateLimit(`meals:${user.id}`, RATE_LIMITS.aiMeals);
  if (!limited.ok) return { ok: false, error: "Daily meal-plan limit reached — try again tomorrow." };

  const parsed = mealPlanInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid plan" };
  const d = parsed.data;

  const supabase = await createClient();
  const hh = await householdId(supabase, user.id);

  const [{ data: settings }, { data: goals }] = await Promise.all([
    supabase
      .from("grocery_settings")
      .select("household_size, weekly_budget, favorites, dislikes, allergies")
      .eq("user_id", user.id)
      .maybeSingle<SettingsRow>(),
    supabase
      .from("nutrition_goals")
      .select("calories, protein_g")
      .eq("user_id", user.id)
      .maybeSingle<{ calories: number | null; protein_g: number | null }>(),
  ]);

  const onSale = await getOnSaleItems();

  const content = await generateMealPlanContent({
    durationDays: d.durationDays,
    householdSize: settings?.household_size ?? 1,
    weeklyBudget: settings?.weekly_budget ?? null,
    favorites: settings?.favorites ?? [],
    dislikes: settings?.dislikes ?? [],
    allergies: settings?.allergies ?? [],
    onSale,
    nutrition: goals ? { calories: goals.calories, protein_g: goals.protein_g } : null,
  });
  if (!content) return { ok: false, error: "Couldn't generate a plan right now — please try again." };

  const { data: plan, error: planErr } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      household_id: hh,
      title: content.title?.slice(0, 120) || `${d.durationDays}-day plan`,
      duration_days: d.durationDays,
      start_date: d.startDate,
      budget: settings?.weekly_budget ?? null,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (planErr || !plan) return { ok: false, error: "Couldn't save the plan." };

  // Persist each distinct recipe; map the AI's numeric id to its new uuid.
  const recipeIdMap = new Map<number, string>();
  const recipeMeta = new Map(content.recipes.map((r) => [r.id, r]));
  for (const r of content.recipes) {
    const { data: recipe, error: rErr } = await supabase
      .from("recipes")
      .insert({
        created_by: user.id,
        household_id: hh,
        source: "ai",
        title: r.title.slice(0, 200),
        description: r.description?.slice(0, 1000) || null,
        instructions: [],
        servings: clampInt(r.servings, 1, 50),
        prep_minutes: r.prep_minutes != null ? clampInt(r.prep_minutes, 0, 1440) : null,
        calories: r.calories != null ? Math.round(r.calories) : null,
        protein_g: r.protein_g != null ? Math.round(r.protein_g) : null,
        carbs_g: r.carbs_g != null ? Math.round(r.carbs_g) : null,
        fat_g: r.fat_g != null ? Math.round(r.fat_g) : null,
        tags: [r.slot],
      })
      .select("id")
      .single<{ id: string }>();
    if (rErr || !recipe) continue;
    recipeIdMap.set(r.id, recipe.id);

    const ingredients = r.ingredients
      .map((ing, idx) => ({
        recipe_id: recipe.id,
        raw_name: ing.name.trim().slice(0, 120),
        quantity: ing.quantity ?? null,
        unit: ing.unit ? ing.unit.slice(0, 20) : null,
        sort: idx,
      }))
      .filter((ing) => ing.raw_name.length > 0)
      .slice(0, 40);
    if (ingredients.length) await supabase.from("recipe_ingredients").insert(ingredients);
  }

  // Build the day-by-day schedule referencing the stored recipes.
  const dayRows: { meal_plan_id: string; date: string; meals: MealPlanDayMeal[] }[] = [];
  for (const day of content.days) {
    if (!Number.isInteger(day.day_index) || day.day_index < 0 || day.day_index >= d.durationDays) continue;
    const date = format(addDays(parseISO(d.startDate), day.day_index), "yyyy-MM-dd");
    const slots: { slot: MealPlanDayMeal["slot"]; aiId: number | null }[] = [
      { slot: "breakfast", aiId: day.breakfast_id },
      { slot: "lunch", aiId: day.lunch_id },
      { slot: "dinner", aiId: day.dinner_id },
    ];
    const meals: MealPlanDayMeal[] = [];
    for (const { slot, aiId } of slots) {
      if (aiId == null) continue;
      const recipeUuid = recipeIdMap.get(aiId);
      const meta = recipeMeta.get(aiId);
      if (!recipeUuid || !meta) continue;
      meals.push({ slot, recipe_id: recipeUuid, title: meta.title.slice(0, 200), servings: clampInt(meta.servings, 1, 50) });
    }
    dayRows.push({ meal_plan_id: plan.id, date, meals });
  }
  if (dayRows.length) await supabase.from("meal_plan_days").insert(dayRows);

  await audit(user.id, "meal_plan.generated", {
    metadata: { days: d.durationDays, recipes: recipeIdMap.size },
  });
  revalidatePath("/grocery/plan");
  return { ok: true, id: plan.id };
}

export async function deleteMealPlan(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid plan" };

  const supabase = await createClient();
  const { error } = await supabase.from("meal_plans").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't delete the plan." };

  revalidatePath("/grocery/plan");
  return { ok: true };
}

/** Roll a meal plan's recipe ingredients up into a new shopping list. */
export async function createListFromMealPlan(planId: string): Promise<IdResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(planId).success) return { ok: false, error: "Invalid plan" };
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, title, household_id")
    .eq("id", planId)
    .maybeSingle<{ id: string; title: string | null; household_id: string | null }>();
  if (!plan) return { ok: false, error: "Plan not found." };

  const { data: days } = await supabase
    .from("meal_plan_days")
    .select("meals")
    .eq("meal_plan_id", planId)
    .returns<{ meals: MealPlanDayMeal[] }[]>();

  const recipeIds = Array.from(
    new Set(
      (days ?? []).flatMap((day) =>
        (day.meals ?? []).map((m) => m.recipe_id).filter((x): x is string => !!x)
      )
    )
  );
  if (recipeIds.length === 0) return { ok: false, error: "This plan has no meals to shop for." };

  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("raw_name, quantity, unit")
    .in("recipe_id", recipeIds)
    .returns<{ raw_name: string; quantity: number | null; unit: string | null }[]>();

  // Combine duplicate ingredients (same normalized name + unit).
  const agg = new Map<string, { name: string; quantity: number | null; unit: string | null }>();
  for (const ing of ings ?? []) {
    const name = ing.raw_name.trim();
    if (!name) continue;
    const norm = normalizeIngredientName(name) || name.toLowerCase();
    const key = `${norm}|${(ing.unit ?? "").toLowerCase()}`;
    const prev = agg.get(key);
    if (!prev) {
      agg.set(key, { name, quantity: ing.quantity ?? null, unit: ing.unit ?? null });
    } else if (ing.quantity != null) {
      prev.quantity = Math.round(((prev.quantity ?? 0) + ing.quantity) * 100) / 100;
    }
  }

  const { data: list, error: listErr } = await supabase
    .from("shopping_lists")
    .insert({
      user_id: user.id,
      household_id: plan.household_id,
      meal_plan_id: planId,
      title: `${plan.title ?? "Meal plan"} — groceries`,
    })
    .select("id")
    .single<{ id: string }>();
  if (listErr || !list) return { ok: false, error: "Couldn't create the list." };

  const itemRows = Array.from(agg.values())
    .slice(0, 200)
    .map((it, idx) => ({
      shopping_list_id: list.id,
      name: it.name.slice(0, 120),
      quantity: it.quantity,
      unit: it.unit ? it.unit.slice(0, 20) : null,
      sort: idx,
    }));
  if (itemRows.length) await supabase.from("shopping_list_items").insert(itemRows);

  await audit(user.id, "shopping_list.created", { metadata: { from: "meal_plan" } });
  revalidatePath("/grocery/lists");
  return { ok: true, id: list.id };
}
