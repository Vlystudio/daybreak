import { Clock, Users, ExternalLink, UtensilsCrossed } from "lucide-react";
import type { MealRecipe } from "@/lib/types";

/** Read-only recipe view shown inside the event dialog for planned meals. */
export function RecipeDetails({ recipe }: { recipe: MealRecipe }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UtensilsCrossed className="h-4 w-4 text-primary" aria-hidden /> Recipe
      </div>

      {recipe.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image} alt="" className="h-40 w-full rounded-lg object-cover" loading="lazy" />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {recipe.readyInMinutes != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {recipe.readyInMinutes} min
          </span>
        )}
        {recipe.servings != null && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden /> serves {recipe.servings}
          </span>
        )}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Original <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>

      {recipe.ingredients.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Ingredients</p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </div>
      )}

      {recipe.steps.length > 0 ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Instructions</p>
          <ol className="space-y-2 text-sm">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="bg-primary/15 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        recipe.sourceUrl && (
          <p className="text-sm text-muted-foreground">
            Full instructions at the{" "}
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              original recipe
            </a>
            .
          </p>
        )
      )}
    </div>
  );
}
