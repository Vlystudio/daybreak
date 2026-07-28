import "server-only";
import { serverEnv } from "@/env";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { isProcessorEnabled } from "@/lib/privacy/processors";

/** Recipe search via Spoonacular (https://spoonacular.com/food-api). */

export interface RecipeSuggestion {
  id: number;
  title: string;
  image: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  sourceUrl: string | null;
  usedCount: number;
  missedCount: number;
  missed: string[];
  ingredients: string[];
  steps: string[];
}

/** Pull the ingredient lines from a Spoonacular result (addRecipeInformation). */
function parseIngredients(r: Record<string, unknown>): string[] {
  const ext = Array.isArray(r.extendedIngredients) ? (r.extendedIngredients as unknown[]) : [];
  return ext
    .map((i) => {
      const ing = i as Record<string, unknown>;
      return typeof ing.original === "string"
        ? ing.original
        : typeof ing.name === "string"
          ? ing.name
          : "";
    })
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

/** Pull the step text from a Spoonacular result's analyzedInstructions. */
function parseSteps(r: Record<string, unknown>): string[] {
  const blocks = Array.isArray(r.analyzedInstructions) ? (r.analyzedInstructions as unknown[]) : [];
  const steps: string[] = [];
  for (const block of blocks) {
    const blockSteps = Array.isArray((block as Record<string, unknown>).steps)
      ? ((block as Record<string, unknown>).steps as unknown[])
      : [];
    for (const s of blockSteps) {
      const step = (s as Record<string, unknown>).step;
      if (typeof step === "string" && step.trim()) steps.push(step.trim());
    }
  }
  return steps.slice(0, 30);
}

// Our dietary labels -> Spoonacular `diet` values.
const DIET_MAP: Record<string, string> = {
  Vegetarian: "vegetarian",
  Vegan: "vegan",
  Pescatarian: "pescetarian",
  Keto: "ketogenic",
  Paleo: "paleo",
  "Gluten-free": "gluten free",
};

// Our dietary labels -> Spoonacular `intolerances` values.
const INTOLERANCE_MAP: Record<string, string> = {
  "Dairy-free": "dairy",
  "Lactose intolerant": "dairy",
  "Nut allergy": "tree nut",
  "Peanut allergy": "peanut",
  "Shellfish allergy": "shellfish",
  "Egg allergy": "egg",
  "Soy allergy": "soy",
  "Gluten-free": "gluten",
};

function mapDietary(restrictions: string[]): { diet?: string; intolerances?: string } {
  const diets = new Set<string>();
  const intol = new Set<string>();
  for (const r of restrictions) {
    if (DIET_MAP[r]) diets.add(DIET_MAP[r]);
    if (INTOLERANCE_MAP[r]) intol.add(INTOLERANCE_MAP[r]);
  }
  return {
    diet: diets.size ? Array.from(diets).join(",") : undefined,
    intolerances: intol.size ? Array.from(intol).join(",") : undefined,
  };
}

export async function searchRecipes(input: {
  ingredients: string[];
  dietaryRestrictions: string[];
  excludeIds: number[];
  number?: number;
}): Promise<RecipeSuggestion[] | null> {
  const apiKey = serverEnv().SPOONACULAR_API_KEY;
  if (!apiKey || !isProcessorEnabled("spoonacular")) return null;
  if (input.ingredients.length === 0) return [];

  const { diet, intolerances } = mapDietary(input.dietaryRestrictions);
  const params = new URLSearchParams({
    apiKey,
    includeIngredients: input.ingredients.join(","),
    number: String(input.number ?? 12),
    sort: "max-used-ingredients",
    addRecipeInformation: "true",
    fillIngredients: "true",
    ignorePantry: "true",
  });
  if (diet) params.set("diet", diet);
  if (intolerances) params.set("intolerances", intolerances);

  try {
    const res = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`, {
      next: { revalidate: 0 },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { results?: unknown[] };
    const exclude = new Set(input.excludeIds);
    const out: RecipeSuggestion[] = [];

    for (const item of json.results ?? []) {
      const r = item as Record<string, unknown>;
      const id = typeof r.id === "number" ? r.id : Number(r.id);
      if (!Number.isFinite(id) || exclude.has(id)) continue;

      const missedRaw = Array.isArray(r.missedIngredients)
        ? (r.missedIngredients as unknown[])
        : [];
      out.push({
        id,
        title: typeof r.title === "string" ? r.title : "Recipe",
        image: typeof r.image === "string" ? r.image : null,
        readyInMinutes: typeof r.readyInMinutes === "number" ? r.readyInMinutes : null,
        servings: typeof r.servings === "number" ? r.servings : null,
        sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
        usedCount: typeof r.usedIngredientCount === "number" ? r.usedIngredientCount : 0,
        missedCount: typeof r.missedIngredientCount === "number" ? r.missedIngredientCount : 0,
        missed: missedRaw
          .map((m) => (m as Record<string, unknown>).name)
          .filter((n): n is string => typeof n === "string"),
        ingredients: parseIngredients(r),
        steps: parseSteps(r),
      });
    }

    return out;
  } catch (err) {
    safeLog("error", "recipes.search_failed", { errorClass: errorClass(err) });
    return null;
  }
}
