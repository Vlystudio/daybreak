"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendChart } from "@/components/health/trend-chart";
import {
  METRIC_DISPLAY,
  TREND_GROUPS,
  metricSeries,
  type TrendGroup,
} from "@/components/health/health-display";
import type {
  HealthBaseline,
  HealthMetricName,
  HealthUnderstandingResult,
} from "@/lib/health/types";

/**
 * Trends, grouped. You pick a group first (Recovery / Sleep / Activity / Vitals
 * / Stress), then see only that group's charts — no endless vertical wall.
 */
export function HealthTrends({ understanding }: { understanding: HealthUnderstandingResult }) {
  const [group, setGroup] = useState<TrendGroup>("Recovery");
  const baselineByMetric = new Map<HealthMetricName, HealthBaseline>(
    understanding.baselines.map((b) => [b.metric, b])
  );

  const metrics = TREND_GROUPS.find((g) => g.group === group)?.metrics ?? [];
  const charts = metrics
    .map((metric) => {
      const display = METRIC_DISPLAY[metric];
      if (!display) return null;
      const data = metricSeries(understanding.dailySignals, metric);
      if (data.length === 0) return null;
      const tf = display.transform ?? ((n: number) => n);
      const baselineRaw = baselineByMetric.get(metric)?.baseline ?? null;
      return {
        metric,
        title: display.label,
        color: display.color,
        unit: display.unit,
        format: display.format,
        data,
        latest: data[data.length - 1]?.value ?? null,
        baseline: baselineRaw != null ? tf(baselineRaw) : null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="space-y-4">
      {/* Group chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TREND_GROUPS.map(({ group: g }) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              group === g
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={group === g}
          >
            {g}
          </button>
        ))}
      </div>

      {charts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No {group.toLowerCase()} data in this range yet. Connect a source or keep syncing —
            charts appear once there&apos;s data to plot.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {charts.map((c) => (
              <TrendChart
                key={c.metric}
                title={c.title}
                color={c.color}
                unit={c.unit}
                data={c.data}
                latest={c.latest}
                baseline={c.baseline}
                format={c.format}
              />
            ))}
          </div>
          {group === "Activity" && (
            <p className="text-muted-foreground text-xs">
              Active calories are a rough estimate on every wearable — read them as a trend, not an
              exact figure.
            </p>
          )}
        </>
      )}
    </div>
  );
}
