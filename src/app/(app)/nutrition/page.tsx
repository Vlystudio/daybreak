import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NutritionView } from "@/components/nutrition/nutrition-view";
import type { FoodLog, BodyMeasurement } from "@/lib/types";

export const metadata = { title: "Nutrition · Daybreak" };
export const dynamic = "force-dynamic";

function localDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date()
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function NutritionPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const today = localDate(profile?.timezone ?? "UTC");

  const [{ data: foods }, { data: water }, { data: latestBody }] = await Promise.all([
    supabase
      .from("food_logs")
      .select("id, date, meal, description, calories, protein_g, carbs_g, fat_g, source, created_at")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: true })
      .returns<FoodLog[]>(),
    supabase
      .from("water_logs")
      .select("amount_ml")
      .eq("user_id", user.id)
      .eq("date", today)
      .returns<{ amount_ml: number }[]>(),
    supabase
      .from("body_measurements")
      .select("date, weight_kg, body_fat_pct, note")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle<BodyMeasurement>(),
  ]);

  const waterMl = (water ?? []).reduce((sum, w) => sum + w.amount_ml, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snap a photo or log it by hand — Daybreak does the calorie math.
        </p>
      </div>
      <NutritionView
        foods={foods ?? []}
        waterMl={waterMl}
        latestBody={latestBody ?? null}
      />
    </div>
  );
}
