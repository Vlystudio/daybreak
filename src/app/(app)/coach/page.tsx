import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CoachTabs } from "@/components/coach/coach-tabs";
import type { FitnessPlan } from "@/lib/planning";

export const metadata = { title: "Coach · Daybreak" };

export default async function CoachPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: plan }, { data: prefs }, { data: groceries }, { data: liked }] = await Promise.all([
    supabase.from("fitness_plans").select("*").eq("user_id", user.id).maybeSingle<FitnessPlan>(),
    supabase
      .from("user_preferences")
      .select("height_in, weight_lb")
      .eq("user_id", user.id)
      .maybeSingle<{ height_in: number | null; weight_lb: number | null }>(),
    supabase
      .from("grocery_items")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("recipe_feedback")
      .select("recipe_id, title")
      .eq("user_id", user.id)
      .eq("liked", true)
      .order("created_at", { ascending: false })
      .returns<{ recipe_id: number; title: string }[]>(),
  ]);

  const hasMetrics = prefs?.height_in != null && prefs?.weight_lb != null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your training, nutrition, and meals in one place.
        </p>
      </div>
      <CoachTabs
        plan={plan ?? null}
        hasMetrics={hasMetrics}
        groceries={groceries ?? []}
        likedRecipes={liked ?? []}
      />
    </div>
  );
}
