"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrainerView } from "@/components/trainer/trainer-view";
import { MealsView } from "@/components/meals/meals-view";
import { WorkoutsView } from "@/components/coach/workouts-view";
import { ExerciseLibraryView } from "@/components/coach/exercise-library-view";
import type { FitnessPlan } from "@/lib/planning";
import type { UserWorkout } from "@/lib/fitness";

export function CoachTabs({
  plan,
  hasMetrics,
  groceries,
  likedRecipes,
  latestWorkout,
  workoutHistory,
  equipment,
  limitations,
}: {
  plan: FitnessPlan | null;
  hasMetrics: boolean;
  groceries: { id: string; name: string }[];
  likedRecipes: { recipe_id: number; title: string }[];
  latestWorkout: UserWorkout | null;
  workoutHistory: UserWorkout[];
  equipment: { id: string; name: string }[];
  limitations: { id: string; description: string }[];
}) {
  return (
    <Tabs defaultValue="workouts">
      <TabsList className="max-w-full flex-wrap">
        <TabsTrigger value="workouts">Workouts</TabsTrigger>
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="trainer">Plan &amp; Nutrition</TabsTrigger>
        <TabsTrigger value="meals">Meals</TabsTrigger>
      </TabsList>
      <TabsContent value="workouts">
        <WorkoutsView
          latestWorkout={latestWorkout}
          history={workoutHistory}
          equipment={equipment}
          limitations={limitations}
        />
      </TabsContent>
      <TabsContent value="library">
        <ExerciseLibraryView />
      </TabsContent>
      <TabsContent value="trainer">
        <TrainerView plan={plan} hasMetrics={hasMetrics} />
      </TabsContent>
      <TabsContent value="meals">
        <MealsView initialGroceries={groceries} likedRecipes={likedRecipes} />
      </TabsContent>
    </Tabs>
  );
}
