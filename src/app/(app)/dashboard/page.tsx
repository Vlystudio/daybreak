import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { integrationsAvailable } from "@/env";
import { NestCard } from "@/components/dashboard/nest-card";
import { Greeting } from "@/components/dashboard/greeting";
import { ConnectToast } from "@/components/dashboard/connect-toast";
import { MorningSummary } from "@/components/dashboard/morning-summary";
import { ReadinessCard } from "@/components/dashboard/readiness-card";
import { SleepCard } from "@/components/dashboard/sleep-card";
import { HrvCard } from "@/components/dashboard/hrv-card";
import { WeatherCard } from "@/components/dashboard/weather-card";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { AdherenceCard } from "@/components/dashboard/adherence-card";
import { CheckinCard } from "@/components/dashboard/checkin-card";
import { NutritionCard } from "@/components/dashboard/nutrition-card";
import { EveningReviewCard } from "@/components/dashboard/evening-review-card";
import { HabitsCard } from "@/components/dashboard/habits-card";
import { NudgesCard } from "@/components/dashboard/nudges-card";
import { CalendarSyncCard } from "@/components/dashboard/calendar-sync-card";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { Recommendations } from "@/components/dashboard/recommendations";
import { FadeIn } from "@/components/motion";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await loadDashboardData(user.id);

  // Lightweight game read for the Nest card (seeds + active companion).
  const supabase = await createClient();
  const { data: gameRow } = await supabase
    .from("user_game")
    .select("seeds, active_bird:user_birds!user_game_active_bird_id_fkey(species_key, nickname)")
    .eq("user_id", user.id)
    .maybeSingle<{ seeds: number; active_bird: { species_key: string; nickname: string | null } | null }>();

  const firstName = (data.profile?.display_name ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>

      <Greeting name={firstName} timezone={data.profile?.timezone ?? "UTC"} />

      <SetupChecklist
        onboardingCompleted={data.onboardingCompleted}
        hasCity={Boolean(data.profile?.city)}
        hasOura={data.connections.some((c) => c.provider === "oura")}
        hasGoogle={data.connections.some((c) => c.provider === "google")}
      />

      <NudgesCard nudges={data.nudges} />

      <FadeIn delay={0.05}>
        <MorningSummary summary={data.summary} />
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FadeIn delay={0.1} className="h-full">
          <ReadinessCard today={data.today} metrics={data.metrics} />
        </FadeIn>
        <FadeIn delay={0.15} className="h-full">
          <SleepCard today={data.today} metrics={data.metrics} />
        </FadeIn>
        <FadeIn delay={0.2} className="h-full">
          <HrvCard today={data.today} metrics={data.metrics} />
        </FadeIn>
        <FadeIn delay={0.25} className="h-full">
          <WeatherCard weather={data.weather} city={data.profile?.city ?? null} />
        </FadeIn>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.3} className="h-full lg:col-span-2">
          <ScheduleTimeline events={data.todayEvents} hasHousehold={data.household !== null} />
        </FadeIn>
        <div className="space-y-4">
          <FadeIn delay={0.33}>
            <AdherenceCard
              total={data.adherence.total}
              done={data.adherence.done}
              streak={data.adherence.streak}
            />
          </FadeIn>
          <FadeIn delay={0.34}>
            <CheckinCard checkin={data.todayCheckin} />
          </FadeIn>
          <FadeIn delay={0.36}>
            <NutritionCard nutrition={data.todayNutrition} />
          </FadeIn>
          <FadeIn delay={0.37}>
            <NestCard
              seeds={gameRow?.seeds ?? 0}
              speciesKey={gameRow?.active_bird?.species_key ?? null}
              nickname={gameRow?.active_bird?.nickname ?? null}
            />
          </FadeIn>
          <FadeIn delay={0.38}>
            <HabitsCard habits={data.habits} />
          </FadeIn>
          <FadeIn delay={0.35}>
            <CalendarSyncCard
              connections={data.connections}
              calendarSync={data.calendarSync}
              fitbitAvailable={integrationsAvailable.fitbit()}
            />
          </FadeIn>
          <FadeIn delay={0.4}>
            <HouseholdCard household={data.household} householdEvents={data.householdEvents} />
          </FadeIn>
        </div>
      </div>

      <FadeIn delay={0.45}>
        <Recommendations summary={data.summary} />
      </FadeIn>

      <FadeIn delay={0.5}>
        <EveningReviewCard review={data.todayReview} />
      </FadeIn>
    </div>
  );
}
