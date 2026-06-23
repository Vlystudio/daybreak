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
import { DailyCheckinModal } from "@/components/dashboard/daily-checkin-modal";
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
    .select(
      "seeds, active_bird:user_birds!user_game_active_bird_id_fkey(species_key, source, nickname, custom_name, custom_blurb, custom_palette, custom_crest, custom_long_tail)"
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      seeds: number;
      active_bird:
        | {
            species_key: string | null;
            source: "hatched" | "photo";
            nickname: string | null;
            custom_name: string | null;
            custom_blurb: string | null;
            custom_palette: import("@/lib/game/birds").BirdPalette | null;
            custom_crest: boolean | null;
            custom_long_tail: boolean | null;
          }
        | null;
    }>();

  const firstName = (data.profile?.display_name ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>

      <DailyCheckinModal checkin={data.todayCheckin} />

      <Greeting
        name={firstName}
        timezone={data.profile?.timezone ?? "UTC"}
        avatarUrl={data.profile?.avatar_url ?? null}
      />

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

      {/* Today focus: schedule beside the two most time-sensitive cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.3} className="h-full lg:col-span-2">
          <ScheduleTimeline events={data.todayEvents} hasHousehold={data.household !== null} />
        </FadeIn>
        <div className="space-y-4">
          <FadeIn delay={0.33}>
            <CheckinCard checkin={data.todayCheckin} />
          </FadeIn>
          <FadeIn delay={0.34}>
            <AdherenceCard
              total={data.adherence.total}
              done={data.adherence.done}
              streak={data.adherence.streak}
            />
          </FadeIn>
        </div>
      </div>

      {/* Everything else tiles in a masonry grid so heights pack tightly */}
      <div className="gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <HabitsCard habits={data.habits} />
        <NestCard
          seeds={gameRow?.seeds ?? 0}
          activeBird={gameRow?.active_bird ?? null}
          nickname={gameRow?.active_bird?.nickname ?? null}
        />
        <NutritionCard nutrition={data.todayNutrition} />
        <CalendarSyncCard
          connections={data.connections}
          calendarSync={data.calendarSync}
          fitbitAvailable={integrationsAvailable.fitbit()}
        />
        <HouseholdCard household={data.household} householdEvents={data.householdEvents} />
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
