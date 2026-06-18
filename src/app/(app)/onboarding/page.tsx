import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { UserPreferences } from "@/lib/planning";

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
        <h1 className="text-2xl font-semibold tracking-tight">Build your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few questions so Daybreak can plan your days, training, and meals around your real life.
          You can change any of this later.
        </p>
      </div>
      <OnboardingForm initial={data ?? null} />
    </div>
  );
}
