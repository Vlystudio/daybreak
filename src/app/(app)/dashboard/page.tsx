import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard-data";
import { Greeting } from "@/components/dashboard/greeting";
import { ConnectToast } from "@/components/dashboard/connect-toast";
import { MorningSummary } from "@/components/dashboard/morning-summary";
import { ReadinessCard } from "@/components/dashboard/readiness-card";
import { SleepCard } from "@/components/dashboard/sleep-card";
import { WeatherCard } from "@/components/dashboard/weather-card";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { AdherenceCard } from "@/components/dashboard/adherence-card";
import { CheckinCard } from "@/components/dashboard/checkin-card";
import { NutritionCard } from "@/components/dashboard/nutrition-card";
import { EveningReviewCard } from "@/components/dashboard/evening-review-card";
import { HabitsCard } from "@/components/dashboard/habits-card";
import { NudgesCard } from "@/components/dashboard/nudges-card";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { Recommendations } from "@/components/dashboard/recommendations";
import { FadeIn } from "@/components/motion";
import { SOCIAL_FEATURES_ENABLED, NUTRITION_ENABLED } from "@/lib/features";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await loadDashboardData(user.id);

  const firstName = (data.profile?.display_name ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>

      <Greeting
        name={firstName}
        timezone={data.profile?.timezone ?? "UTC"}
        avatarUrl={data.profile?.avatar_url ?? null}
      />

      <SetupChecklist
        onboardingCompleted={data.onboardingCompleted}
        hasCity={Boolean(data.profile?.city)}
      />

      {SOCIAL_FEATURES_ENABLED && <NudgesCard nudges={data.nudges} />}

      <FadeIn delay={0.05}>
        <MorningSummary
          summary={data.summary}
          eventCount={data.todayEvents.length}
          habitCount={data.habits.length}
          canGenerate={data.canGenerateBriefing}
        />
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        <FadeIn delay={0.1} className="h-full">
          <ReadinessCard today={data.today} metrics={data.metrics} />
        </FadeIn>
        <FadeIn delay={0.15} className="h-full">
          <SleepCard today={data.today} metrics={data.metrics} />
        </FadeIn>
        <FadeIn delay={0.25} className="h-full">
          <WeatherCard weather={data.weather} city={data.profile?.city ?? null} />
        </FadeIn>
      </div>

      {/* Today focus: schedule beside the two most time-sensitive cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.3} className="h-full lg:col-span-2">
          <ScheduleTimeline
            events={data.todayEvents}
            hasHousehold={SOCIAL_FEATURES_ENABLED && data.household !== null}
          />
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

      {/* Daily habits and reflection remain easy to reach. */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <HabitsCard habits={data.habits} />
        <EveningReviewCard review={data.todayReview} />
        {NUTRITION_ENABLED && <NutritionCard nutrition={data.todayNutrition} />}
        {SOCIAL_FEATURES_ENABLED && (
          <HouseholdCard household={data.household} householdEvents={data.householdEvents} />
        )}
      </div>

      <FadeIn delay={0.45}>
        <Recommendations summary={data.summary} />
      </FadeIn>
    </div>
  );
}
