import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MealPlanView, type RecipeInfo } from "@/components/grocery/meal-plan-view";
import type { MealPlan, MealPlanDay } from "@/lib/grocery";

export const metadata = { title: "Meal plan · Daybreak" };

interface RecipeRow {
  id: string;
  calories: number | null;
  prep_minutes: number | null;
  description: string | null;
}

export default async function MealPlanPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, title, duration_days, start_date, budget, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MealPlan>();

  let days: MealPlanDay[] = [];
  const recipeInfo: Record<string, RecipeInfo> = {};

  if (plan) {
    const { data: dayRows } = await supabase
      .from("meal_plan_days")
      .select("id, meal_plan_id, date, meals")
      .eq("meal_plan_id", plan.id)
      .order("date")
      .returns<MealPlanDay[]>();
    days = dayRows ?? [];

    const recipeIds = Array.from(
      new Set(
        days.flatMap((d) => (d.meals ?? []).map((m) => m.recipe_id).filter((x): x is string => !!x))
      )
    );
    if (recipeIds.length) {
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, calories, prep_minutes, description")
        .in("id", recipeIds)
        .returns<RecipeRow[]>();
      for (const r of recipes ?? []) {
        recipeInfo[r.id] = {
          calories: r.calories,
          prep_minutes: r.prep_minutes,
          description: r.description,
        };
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href="/grocery"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Grocery
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Meal plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a week (or more) of meals, then turn it into a shopping list.
        </p>
      </div>

      <MealPlanView
        plan={plan ?? null}
        days={days}
        recipeInfo={recipeInfo}
        defaultStartDate={format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}
