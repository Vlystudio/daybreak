"use client";

import { CheckinCard } from "@/components/dashboard/checkin-card";
import { HealthCheckin } from "@/components/health/health-checkin";
import {
  SelfReportTrends,
  type WeightPoint,
  type NutritionPoint,
  type FeelingPoint,
} from "@/components/health/self-report-trends";
import type { CheckinMessage } from "@/actions/health";
import type { SubjectiveCheckin } from "@/lib/types";

/**
 * Check-in makes subjective health a first-class signal: a fast daily mood/
 * energy/stress/soreness log, an optional conversational coach, and trends over
 * what you log (weight, body fat, nutrition, feelings).
 */
export function HealthCheckIn({
  todayCheckin,
  conversation,
  hasData,
  selfReport,
}: {
  todayCheckin: SubjectiveCheckin | null;
  conversation: { id: string; messages: CheckinMessage[] } | null;
  hasData: boolean;
  selfReport: {
    today: string;
    weight: WeightPoint[];
    nutrition: NutritionPoint[];
    feelings: FeelingPoint[];
  };
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <CheckinCard checkin={todayCheckin} />
        <HealthCheckin initial={conversation} hasData={hasData} />
      </div>
      <SelfReportTrends
        today={selfReport.today}
        weight={selfReport.weight}
        nutrition={selfReport.nutrition}
        feelings={selfReport.feelings}
      />
    </div>
  );
}
