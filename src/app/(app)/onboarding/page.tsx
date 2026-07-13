import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { GeneratePlanCard } from "@/components/onboarding/generate-plan-card";
import type { UserPreferences } from "@/lib/planning";
import { AiConsentFirstUse } from "@/components/onboarding/ai-consent-first-use";
import { hasCurrentAiConsentDecision } from "@/lib/integrations/ai-consent";

export const metadata = { title: "Your plan · Daybreak" };

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
        <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A few questions so Daybreak can plan your days, training, and meals around your real life.
          You can change any of this later.
        </p>
      </div>
      <div className="mb-5">
        {hasCurrentAiConsentDecision(data) ? (
          <GeneratePlanCard ready={data?.onboarding_completed ?? false} />
        ) : (
          <AiConsentFirstUse />
        )}
      </div>
      <OnboardingForm initial={data ?? null} />
    </div>
  );
}
