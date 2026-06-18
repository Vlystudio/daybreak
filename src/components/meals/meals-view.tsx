"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Search, ThumbsUp, ThumbsDown, Clock, ExternalLink, Heart, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addGrocery,
  removeGrocery,
  getRecipeSuggestions,
  rateRecipe,
  addMealToSchedule,
  addGroceries,
} from "@/actions/meals";
import type { RecipeSuggestion } from "@/lib/integrations/recipes";

type Grocery = { id: string; name: string };
type Liked = { recipe_id: number; title: string };

export function MealsView({
  initialGroceries,
  likedRecipes,
}: {
  initialGroceries: Grocery[];
  likedRecipes: Liked[];
}) {
  const [groceries, setGroceries] = useState<Grocery[]>(initialGroceries);
  const [newItem, setNewItem] = useState("");
  const [recipes, setRecipes] = useState<RecipeSuggestion[] | null>(null);
  const [ratings, setRatings] = useState<Record<number, "liked" | "disliked">>({});
  const [searching, startSearch] = useTransition();
  const [, startMutate] = useTransition();

  function add() {
    const name = newItem.trim();
    if (!name) return;
    setNewItem("");
    const tempId = `temp-${Date.now()}`;
    setGroceries((g) => [...g, { id: tempId, name }]);
    startMutate(async () => {
      const res = await addGrocery(name);
      if (res.ok) {
        setGroceries((g) => g.map((x) => (x.id === tempId ? { ...x, id: res.id } : x)));
      } else {
        toast.error(res.error);
        setGroceries((g) => g.filter((x) => x.id !== tempId));
      }
    });
  }

  function remove(id: string) {
    setGroceries((g) => g.filter((x) => x.id !== id));
    startMutate(async () => {
      const res = await removeGrocery(id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function find() {
    startSearch(async () => {
      const res = await getRecipeSuggestions();
      if (res.ok) {
        setRecipes(res.recipes);
        if (res.recipes.length === 0) toast("No recipes matched — try adding a few more groceries.");
      } else {
        toast.error(res.error);
      }
    });
  }

  function planMeal(r: RecipeSuggestion) {
    startMutate(async () => {
      const res = await addMealToSchedule({
        recipeId: r.id,
        title: r.title,
        recipe: {
          image: r.image,
          sourceUrl: r.sourceUrl,
          readyInMinutes: r.readyInMinutes,
          servings: r.servings,
          ingredients: r.ingredients,
          steps: r.steps,
        },
      });
      if (res.ok) toast.success("Added to your schedule — open it there for the recipe.");
      else toast.error(res.error);
    });
  }

  function addMissing(r: RecipeSuggestion) {
    if (r.missed.length === 0) return;
    startMutate(async () => {
      const res = await addGroceries(r.missed);
      if (res.ok) {
        toast.success("Added missing ingredients to your list.");
        setGroceries((g) => [
          ...g,
          ...r.missed.map((name, i) => ({ id: `tmp-${Date.now()}-${i}`, name })),
        ]);
      } else {
        toast.error(res.error);
      }
    });
  }

  function rate(r: RecipeSuggestion, liked: boolean) {
    setRatings((m) => ({ ...m, [r.id]: liked ? "liked" : "disliked" }));
    if (!liked) setRecipes((rs) => (rs ? rs.filter((x) => x.id !== r.id) : rs));
    startMutate(async () => {
      const res = await rateRecipe({ recipeId: r.id, title: r.title, liked });
      if (!res.ok) toast.error(res.error);
      else toast.success(liked ? "Saved to your likes." : "Got it — we'll stop suggesting that.");
    });
  }

  return (
    <div className="space-y-5">
      {/* Groceries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your groceries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Add an item — e.g. chicken, rice, broccoli"
              maxLength={80}
            />
            <Button type="button" variant="outline" onClick={add}>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          </div>
          {groceries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {groceries.map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/50 px-3 py-1 text-sm"
                >
                  {g.name}
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    aria-label={`Remove ${g.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items yet — add what you bought this week.</p>
          )}
          <Button onClick={find} disabled={searching || groceries.length === 0} className="w-full sm:w-auto">
            <Search className="h-4 w-4" aria-hidden /> {searching ? "Finding recipes…" : "Find recipes"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {recipes && recipes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              {r.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt="" className="h-40 w-full object-cover" loading="lazy" />
              )}
              <CardContent className="space-y-2 p-4">
                <h3 className="font-medium leading-snug">{r.title}</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {r.readyInMinutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> {r.readyInMinutes} min
                    </span>
                  )}
                  <span>Uses {r.usedCount} of your items</span>
                  {r.missedCount > 0 && <span>· needs {r.missedCount} more</span>}
                </div>
                {r.missed.length > 0 && (
                  <p className="text-xs text-muted-foreground">You&apos;ll also need: {r.missed.slice(0, 5).join(", ")}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => planMeal(r)}>
                    <CalendarPlus className="h-4 w-4" aria-hidden /> Plan meal
                  </Button>
                  {r.missed.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => addMissing(r)}>
                      + {r.missed.length} to list
                    </Button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={ratings[r.id] === "liked" ? "default" : "outline"}
                      onClick={() => rate(r, true)}
                      aria-label="Like this recipe"
                    >
                      <ThumbsUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => rate(r, false)}
                      aria-label="Dislike this recipe"
                    >
                      <ThumbsDown className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Liked recipes */}
      {likedRecipes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4" aria-hidden /> Recipes you like
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {likedRecipes.map((l) => (
                <li key={l.recipe_id}>{l.title}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
