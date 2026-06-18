"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrainerView } from "@/components/trainer/trainer-view";
import { MealsView } from "@/components/meals/meals-view";
import type { FitnessPlan } from "@/lib/planning";

export function CoachTabs({
  plan,
  hasMetrics,
  groceries,
  likedRecipes,
}: {
  plan: FitnessPlan | null;
  hasMetrics: boolean;
  groceries: { id: string; name: string }[];
  likedRecipes: { recipe_id: number; title: string }[];
}) {
  return (
    <Tabs defaultValue="trainer">
      <TabsList>
        <TabsTrigger value="trainer">Trainer</TabsTrigger>
        <TabsTrigger value="meals">Meals</TabsTrigger>
      </TabsList>
      <TabsContent value="trainer">
        <TrainerView plan={plan} hasMetrics={hasMetrics} />
      </TabsContent>
      <TabsContent value="meals">
        <MealsView initialGroceries={groceries} likedRecipes={likedRecipes} />
      </TabsContent>
    </Tabs>
  );
}
