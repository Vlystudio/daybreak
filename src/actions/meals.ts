"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { searchRecipes, type RecipeSuggestion } from "@/lib/integrations/recipes";
import { zonedToUtc, localToday } from "@/lib/tz";
import type { ActionResult } from "@/actions/schedule";

const grocerySchema = z.string().trim().min(1, "Enter an item").max(80);

export async function addGrocery(
  name: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = grocerySchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .insert({ user_id: user.id, name: parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: "Couldn't add that item." };

  revalidatePath("/coach");
  return { ok: true, id: data.id };
}

export async function removeGrocery(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("grocery_items").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that item." };

  revalidatePath("/coach");
  return { ok: true };
}

export type SuggestionsResult =
  | { ok: true; recipes: RecipeSuggestion[] }
  | { ok: false; error: string };

export async function getRecipeSuggestions(): Promise<SuggestionsResult> {
  const user = await requireUser();

  const limited = await rateLimit(`sync:${user.id}`, RATE_LIMITS.sync);
  if (!limited.ok) return { ok: false, error: "You've searched a lot recently — try again shortly." };

  const supabase = await createClient();
  const [{ data: groceries }, { data: prefs }, { data: feedback }] = await Promise.all([
    supabase.from("grocery_items").select("name").eq("user_id", user.id).returns<{ name: string }[]>(),
    supabase
      .from("user_preferences")
      .select("dietary_restrictions")
      .eq("user_id", user.id)
      .maybeSingle<{ dietary_restrictions: string[] }>(),
    supabase
      .from("recipe_feedback")
      .select("recipe_id, liked")
      .eq("user_id", user.id)
      .returns<{ recipe_id: number; liked: boolean }[]>(),
  ]);

  const ingredients = (groceries ?? []).map((g) => g.name);
  if (ingredients.length === 0) return { ok: false, error: "Add some groceries first." };

  const disliked = (feedback ?? []).filter((f) => !f.liked).map((f) => f.recipe_id);

  const recipes = await searchRecipes({
    ingredients,
    dietaryRestrictions: prefs?.dietary_restrictions ?? [],
    excludeIds: disliked,
  });
  if (recipes === null) {
    return { ok: false, error: "Recipe search is unavailable right now — try again soon." };
  }
  return { ok: true, recipes };
}

const ratingSchema = z.object({
  recipeId: z.number().int(),
  title: z.string().trim().min(1).max(300),
  liked: z.boolean(),
});

export async function rateRecipe(input: {
  recipeId: number;
  title: string;
  liked: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid rating" };

  const supabase = await createClient();
  const { error } = await supabase.from("recipe_feedback").upsert(
    {
      user_id: user.id,
      recipe_id: parsed.data.recipeId,
      title: parsed.data.title,
      liked: parsed.data.liked,
    },
    { onConflict: "user_id,recipe_id" }
  );
  if (error) return { ok: false, error: "Couldn't save your rating." };

  revalidatePath("/coach");
  return { ok: true };
}

/** Add a recipe to today's schedule as a planned dinner. */
export async function addMealToSchedule(input: { recipeId: number; title: string }): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment — too many changes at once." };

  const title = String(input.title || "").trim().slice(0, 180);
  if (!title) return { ok: false, error: "Invalid recipe." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";
  const start = zonedToUtc(localToday(tz), "18:00", tz);
  const end = new Date(start.getTime() + 45 * 60_000);

  const { error } = await supabase.from("schedule_events").insert({
    user_id: user.id,
    title,
    description: "Planned meal",
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: false,
    source: "manual",
    color: "honey",
  });
  if (error) return { ok: false, error: "Couldn't add the meal." };

  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

/** Add several grocery items at once (e.g. a recipe's missing ingredients). */
export async function addGroceries(names: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const clean = Array.from(
    new Set((names ?? []).map((n) => String(n).trim()).filter((n) => n.length > 0 && n.length <= 80))
  ).slice(0, 30);
  if (clean.length === 0) return { ok: false, error: "Nothing to add." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_items")
    .insert(clean.map((name) => ({ user_id: user.id, name })));
  if (error) return { ok: false, error: "Couldn't add items." };

  revalidatePath("/coach");
  return { ok: true };
}
