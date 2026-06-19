"use client";

import { Battery } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing, scoreTone } from "@/components/dashboard/score-ring";
import type { HealthMetric } from "@/lib/types";

export function ReadinessCard({ today, metrics }: { today: HealthMetric | null; metrics: HealthMetric[] }) {
  const todayScore = today?.readiness_score ?? null;
  // Readiness needs a night of sleep, so today's often isn't in yet — fall back
  // to the most recent reading instead of looking like there's no data at all.
  const latest =
    todayScore != null ? today : (metrics.filter((m) => m.readiness_score != null).at(-1) ?? null);
  const score = latest?.readiness_score ?? null;
  const tone = scoreTone(score);
  const isStale = todayScore == null && score != null;

  const recent = metrics.filter((m) => m.readiness_score != null).slice(-7);
  const avg =
    recent.length > 0
      ? Math.round(recent.reduce((s, m) => s + (m.readiness_score ?? 0), 0) / recent.length)
      : null;
  const delta = score != null && avg != null ? score - avg : null;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Battery className="h-4 w-4 text-primary" aria-hidden />
          Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 pb-6">
        <ScoreRing score={score} color={tone.color} label={`Readiness ${score ?? "unknown"}`} />
        <p className="font-medium" style={{ color: tone.color }}>
          {tone.word}
        </p>
        {score == null ? (
          <p className="text-center text-sm text-muted-foreground">
            Your readiness appears after a night of Oura sleep data.
          </p>
        ) : isStale ? (
          <p className="text-center text-sm text-muted-foreground">
            Latest, {latest?.date ? format(parseISO(latest.date), "MMM d") : "recently"}. Last night isn&apos;t in
            yet — open the Oura app to sync your ring.
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {delta == null
              ? "Tracking your recovery each morning."
              : delta >= 2
                ? `${delta} points above your weekly average — a good day to lean in.`
                : delta <= -2
                  ? `${Math.abs(delta)} points below your weekly average — be gentle with yourself.`
                  : "Right around your weekly average."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
