"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Sparkles, ShoppingCart, Trash2, Clock, Flame } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MEAL_PLAN_DURATIONS, type MealPlan, type MealPlanDay } from "@/lib/grocery";
import { generateMealPlan, deleteMealPlan, createListFromMealPlan } from "@/actions/meal-plan";

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export interface RecipeInfo {
  calories: number | null;
  prep_minutes: number | null;
  description: string | null;
}

export function MealPlanView({
  plan,
  days,
  recipeInfo,
  defaultStartDate,
}: {
  plan: MealPlan | null;
  days: MealPlanDay[];
  recipeInfo: Record<string, RecipeInfo>;
  defaultStartDate: string;
}) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const [acting, startAction] = useTransition();

  const [duration, setDuration] = useState<number>(7);
  const [startDate, setStartDate] = useState(defaultStartDate);

  function generate() {
    startGenerate(async () => {
      const res = await generateMealPlan({ durationDays: duration, startDate });
      if (res.ok) {
        toast.success("Meal plan ready.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function makeList() {
    if (!plan) return;
    startAction(async () => {
      const res = await createListFromMealPlan(plan.id);
      if (res.ok) {
        toast.success("Shopping list created.");
        router.push(`/grocery/lists/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    if (!plan) return;
    startAction(async () => {
      const res = await deleteMealPlan(plan.id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-honey" aria-hidden /> Generate a meal plan
          </CardTitle>
          <CardDescription>
            Built around your household size, budget, favorites, and allergies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="plan-duration">Length</Label>
              <select
                id="plan-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                {MEAL_PLAN_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-start">Start date</Label>
              <Input
                id="plan-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex sm:justify-end">
              <Button onClick={generate} disabled={generating}>
                {generating ? "Generating…" : plan ? "Generate new plan" : "Generate plan"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{plan.title || "Meal plan"}</h2>
              <p className="text-sm text-muted-foreground">
                {plan.duration_days} days from {format(parseISO(plan.start_date), "MMM d")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={makeList} disabled={acting}>
                <ShoppingCart className="h-4 w-4" aria-hidden /> Shopping list
              </Button>
              <Button variant="ghost" onClick={remove} disabled={acting} aria-label="Delete plan">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {days.map((day) => (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {format(parseISO(day.date), "EEEE, MMM d")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {day.meals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Leftovers / open.</p>
                  ) : (
                    <ul className="space-y-2">
                      {day.meals.map((meal, i) => {
                        const info = meal.recipe_id ? recipeInfo[meal.recipe_id] : undefined;
                        return (
                          <li key={`${day.id}-${i}`} className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5 w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {SLOT_LABEL[meal.slot] ?? meal.slot}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{meal.title}</span>
                              {info?.description && (
                                <span className="block text-xs text-muted-foreground">{info.description}</span>
                              )}
                              <span className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {info?.calories != null && (
                                  <span className="inline-flex items-center gap-1">
                                    <Flame className="h-3 w-3" aria-hidden /> {info.calories} cal
                                  </span>
                                )}
                                {info?.prep_minutes != null && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" aria-hidden /> {info.prep_minutes} min
                                  </span>
                                )}
                                {meal.servings != null && <span>serves {meal.servings}</span>}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
