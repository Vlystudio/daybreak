import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PlanPreferencesForm } from "@/components/onboarding/plan-preferences-form";
import { COACH_ENABLED, GROCERY_ENABLED, NUTRITION_ENABLED } from "@/lib/features";
import { availableIntegrations } from "@/lib/integrations/availability";
import type { UserPreferences } from "@/lib/planning";

export const metadata = { title: "Plan preferences" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<UserPreferences>();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Plan preferences</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Set your daily rhythm and the time you want to keep free. You can change these anytime.
        </p>
      </div>
      {COACH_ENABLED || GROCERY_ENABLED || NUTRITION_ENABLED ? (
        <OnboardingForm initial={data ?? null} />
      ) : (
        <PlanPreferencesForm initial={data ?? null} aiAvailable={availableIntegrations.openai()} />
      )}
    </div>
  );
}
