import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard-data";
import { Greeting } from "@/components/dashboard/greeting";
import { ConnectToast } from "@/components/dashboard/connect-toast";
import { MorningSummary } from "@/components/dashboard/morning-summary";
import { ReadinessCard } from "@/components/dashboard/readiness-card";
import { SleepCard } from "@/components/dashboard/sleep-card";
import { HrvCard } from "@/components/dashboard/hrv-card";
import { WeatherCard } from "@/components/dashboard/weather-card";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { CalendarSyncCard } from "@/components/dashboard/calendar-sync-card";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { Recommendations } from "@/components/dashboard/recommendations";
import { FadeIn } from "@/components/motion";

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

      <Greeting name={firstName} timezone={data.profile?.timezone ?? "UTC"} />

      <SetupChecklist
        onboardingCompleted={data.onboardingCompleted}
        hasCity={Boolean(data.profile?.city)}
        hasOura={data.connections.some((c) => c.provider === "oura")}
        hasGoogle={data.connections.some((c) => c.provider === "google")}
      />

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
          <FadeIn delay={0.35}>
            <CalendarSyncCard connections={data.connections} calendarSync={data.calendarSync} />
          </FadeIn>
          <FadeIn delay={0.4}>
            <HouseholdCard household={data.household} householdEvents={data.householdEvents} />
          </FadeIn>
        </div>
      </div>

      <FadeIn delay={0.45}>
        <Recommendations summary={data.summary} />
      </FadeIn>
    </div>
  );
}
