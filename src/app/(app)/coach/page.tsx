import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CoachTabs } from "@/components/coach/coach-tabs";
import type { FitnessPlan } from "@/lib/planning";
import type { UserWorkout } from "@/lib/fitness";

export const metadata = { title: "Coach" };

export default async function CoachPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [
    { data: plan },
    { data: prefs },
    { data: groceries },
    { data: liked },
    { data: workouts },
    { data: equipment },
    { data: limitations },
  ] = await Promise.all([
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
    supabase
      .from("user_workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<UserWorkout[]>(),
    supabase
      .from("user_equipment")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("user_limitations")
      .select("id, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<{ id: string; description: string }[]>(),
  ]);

  const hasMetrics = prefs?.height_in != null && prefs?.weight_lb != null;
  const workoutHistory = workouts ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your training, nutrition, and meals in one place.
        </p>
      </div>
      <CoachTabs
        plan={plan ?? null}
        hasMetrics={hasMetrics}
        groceries={groceries ?? []}
        likedRecipes={liked ?? []}
        latestWorkout={workoutHistory[0] ?? null}
        workoutHistory={workoutHistory}
        equipment={equipment ?? []}
        limitations={limitations ?? []}
      />
    </div>
  );
}
