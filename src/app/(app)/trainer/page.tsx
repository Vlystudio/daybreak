import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TrainerView } from "@/components/trainer/trainer-view";
import type { FitnessPlan } from "@/lib/planning";

export const metadata = { title: "Trainer · Daybreak" };

export default async function TrainerPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: plan }, { data: prefs }] = await Promise.all([
    supabase.from("fitness_plans").select("*").eq("user_id", user.id).maybeSingle<FitnessPlan>(),
    supabase
      .from("user_preferences")
      .select("height_in, weight_lb")
      .eq("user_id", user.id)
      .maybeSingle<{ height_in: number | null; weight_lb: number | null }>(),
  ]);

  const hasMetrics = prefs?.height_in != null && prefs?.weight_lb != null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Personal trainer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A workout program and nutrition targets built around your body, goal, and dietary needs.
        </p>
      </div>
      <TrainerView plan={plan ?? null} hasMetrics={hasMetrics} />
    </div>
  );
}
