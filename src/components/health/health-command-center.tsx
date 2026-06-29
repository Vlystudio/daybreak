"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HealthOverview } from "@/components/health/health-overview";
import { HealthTrends } from "@/components/health/health-trends";
import { HealthSources } from "@/components/health/health-sources";
import { HealthCheckIn } from "@/components/health/health-check-in";
import type {
  WeightPoint,
  NutritionPoint,
  FeelingPoint,
} from "@/components/health/self-report-trends";
import type { CheckinMessage } from "@/actions/health";
import type { SubjectiveCheckin } from "@/lib/types";
import type { HealthUnderstandingResult } from "@/lib/health/types";

/**
 * The Health tab shell: a four-section, mobile-first dashboard over the
 * deterministic health understanding. Overview (default) → Trends → Sources →
 * Check-in. Every function is two taps away: pick a tab, then act.
 */
export function HealthCommandCenter({
  understanding,
  todayCheckin,
  conversation,
  selfReport,
}: {
  understanding: HealthUnderstandingResult;
  todayCheckin: SubjectiveCheckin | null;
  conversation: { id: string; messages: CheckinMessage[] } | null;
  selfReport: {
    today: string;
    weight: WeightPoint[];
    nutrition: NutritionPoint[];
    feelings: FeelingPoint[];
  };
}) {
  const hasData = understanding.baselines.some((b) => b.sampleCount >= 3);

  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full sm:w-auto">
        {[
          ["overview", "Overview"],
          ["trends", "Trends"],
          ["sources", "Sources"],
          ["checkin", "Check-in"],
        ].map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="flex-1 px-2 sm:flex-none sm:px-4">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <HealthOverview understanding={understanding} />
      </TabsContent>
      <TabsContent value="trends">
        <HealthTrends understanding={understanding} />
      </TabsContent>
      <TabsContent value="sources">
        <HealthSources understanding={understanding} />
      </TabsContent>
      <TabsContent value="checkin">
        <HealthCheckIn
          todayCheckin={todayCheckin}
          conversation={conversation}
          hasData={hasData}
          selfReport={selfReport}
        />
      </TabsContent>
    </Tabs>
  );
}
