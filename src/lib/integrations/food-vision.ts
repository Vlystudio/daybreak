import "server-only";
import { openaiClient, logUsage } from "@/lib/integrations/openai";
import { serverEnv } from "@/env";

/**
 * Food photo → calories. Uses LogMeal (https://logmeal.com) when
 * LOGMEAL_API_KEY is set — a dedicated food-recognition + nutrition API — and
 * otherwise falls back to OpenAI vision, which is already configured. Both map
 * into the same FoodAnalysis. Photos are processed transiently and never stored.
 */

export interface FoodItem {
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface FoodAnalysis {
  /** A short human-readable description of the whole plate. */
  description: string;
  items: FoodItem[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** 0-1 self-rated confidence, when the provider gives one. */
  confidence: number | null;
  provider: "logmeal" | "openai";
}

/** Parse a data URL ("data:image/jpeg;base64,...") into its parts. */
function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function round(n: unknown): number | null {
  return typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : null;
}

export async function analyzeFoodImage(dataUrl: string): Promise<FoodAnalysis | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  if (serverEnv().LOGMEAL_API_KEY) {
    const result = await analyzeWithLogMeal(parsed.mime, parsed.base64);
    if (result) return result;
    // Dedicated API failed — fall through to OpenAI so the user still gets a number.
  }
  return analyzeWithOpenAI(dataUrl);
}

// ── LogMeal (dedicated food API) ─────────────────────────────────────────────

async function analyzeWithLogMeal(mime: string, base64: string): Promise<FoodAnalysis | null> {
  const apiKey = serverEnv().LOGMEAL_API_KEY!;
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    // 1) Segmentation + recognition → imageId + detected dishes.
    const bytes = Buffer.from(base64, "base64");
    const form = new FormData();
    form.append("image", new Blob([bytes], { type: mime }), "meal.jpg");

    const segRes = await fetch("https://api.logmeal.es/v2/image/segmentation/complete/v1.0", {
      method: "POST",
      headers,
      body: form,
    });
    if (!segRes.ok) return null;
    const seg = (await segRes.json()) as {
      imageId?: number;
      segmentation_results?: { recognition_results?: { name?: string; prob?: number }[] }[];
    };
    if (!seg.imageId) return null;

    // 2) Nutritional info for the recognized image.
    const nutRes = await fetch("https://api.logmeal.es/v2/recipe/nutritionalInfo/v1.0", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: seg.imageId }),
    });
    if (!nutRes.ok) return null;
    const nut = (await nutRes.json()) as {
      nutritional_info?: {
        calories?: number;
        totalNutrients?: { PROCNT?: { quantity?: number }; CHOCDF?: { quantity?: number }; FAT?: { quantity?: number } };
      };
      foodName?: string[];
    };

    const dishes = (seg.segmentation_results ?? [])
      .map((s) => s.recognition_results?.[0])
      .filter((r): r is { name?: string; prob?: number } => Boolean(r));
    const names = (nut.foodName?.length ? nut.foodName : dishes.map((d) => d.name).filter(Boolean)) as string[];
    const info = nut.nutritional_info;
    const totals = info?.totalNutrients;

    return {
      description: names.length ? names.join(", ") : "Meal",
      items: names.map((name) => ({ name, calories: null, protein_g: null, carbs_g: null, fat_g: null })),
      calories: round(info?.calories),
      protein_g: round(totals?.PROCNT?.quantity),
      carbs_g: round(totals?.CHOCDF?.quantity),
      fat_g: round(totals?.FAT?.quantity),
      confidence: dishes[0]?.prob != null ? round(dishes[0].prob) : null,
      provider: "logmeal",
    };
  } catch (err) {
    console.error("[food-vision] LogMeal failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

// ── OpenAI vision (fallback) ─────────────────────────────────────────────────

const VISION_PROMPT = `You are a nutrition estimator. Identify the food in the image and estimate its nutrition for the portion shown.
Respond with JSON exactly: {"description": "short plate description", "items": [{"name": str, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}], "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": number between 0 and 1}.
Totals should be the sum across items. If you cannot tell it's food, return all numbers as 0 and description "Not food".`;

async function analyzeWithOpenAI(dataUrl: string): Promise<FoodAnalysis | null> {
  const client = openaiClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Estimate the nutrition of this meal." },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });

    logUsage("food-vision", completion.usage);
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const items = Array.isArray(p.items)
      ? (p.items as Record<string, unknown>[]).map((it) => ({
          name: typeof it.name === "string" ? it.name : "Item",
          calories: round(it.calories),
          protein_g: round(it.protein_g),
          carbs_g: round(it.carbs_g),
          fat_g: round(it.fat_g),
        }))
      : [];

    return {
      description: typeof p.description === "string" ? p.description : "Meal",
      items,
      calories: round(p.calories),
      protein_g: round(p.protein_g),
      carbs_g: round(p.carbs_g),
      fat_g: round(p.fat_g),
      confidence: round(p.confidence),
      provider: "openai",
    };
  } catch (err) {
    console.error("[food-vision] OpenAI failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
