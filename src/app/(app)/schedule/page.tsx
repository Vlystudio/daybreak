import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "@/components/schedule/schedule-view";
import type { ScheduleEvent } from "@/lib/types";
import { SOCIAL_FEATURES_ENABLED } from "@/lib/features";
import { GeneratePlanCard } from "@/components/onboarding/generate-plan-card";
import { hasCurrentAiConsentDecision } from "@/lib/integrations/ai-consent";
import type { UserPreferences } from "@/lib/planning";
import { availableIntegrations as integrationsAvailable } from "@/lib/integrations/availability";

export const metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

function eventWindow(): { start: Date; end: Date } {
  const now = Date.now();
  return { start: new Date(now - 28 * 86_400_000), end: new Date(now + 56 * 86_400_000) };
}

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { start: windowStart, end: windowEnd } = eventWindow();

  let eventsQuery = supabase
    .from("schedule_events")
    .select("*")
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString());
  if (!SOCIAL_FEATURES_ENABLED) eventsQuery = eventsQuery.eq("user_id", user.id);

  const [{ data: events }, { data: membership }, { data: prefs }] = await Promise.all([
    eventsQuery.order("starts_at", { ascending: true }).returns<ScheduleEvent[]>(),
    supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle<{ household_id: string }>(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<UserPreferences>(),
  ]);

  return (
    <ScheduleView
      events={events ?? []}
      currentUserId={user.id}
      hasHousehold={SOCIAL_FEATURES_ENABLED && membership !== null}
      planningControls={
        <GeneratePlanCard
          ready={prefs?.onboarding_completed === true}
          aiAvailable={integrationsAvailable.openai()}
          aiAllowed={
            integrationsAvailable.openai() &&
            hasCurrentAiConsentDecision(prefs) &&
            prefs?.allow_ai_basic_processing === true
          }
        />
      }
    />
  );
}
