import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MealsView } from "@/components/meals/meals-view";

export const metadata = { title: "Meals · Daybreak" };

export default async function MealsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: groceries }, { data: liked }] = await Promise.all([
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Meals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the groceries you have this week and Daybreak finds recipes that use them — respecting
          your dietary restrictions and learning what you like over time.
        </p>
      </div>
      <MealsView initialGroceries={groceries ?? []} likedRecipes={liked ?? []} />
    </div>
  );
}
