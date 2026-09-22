"use client";

import { format, parseISO, subDays } from "date-fns";
import Link from "next/link";
import { useUiPreference } from "@/components/ui-preferences";
import { Button } from "@/components/ui/button";
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
  const [group, setGroup] = useUiPreference<TrendGroup>("health-group", "Recovery");
  const [range, setRange] = useUiPreference<string>("health-range", "30");
  const cutoff = format(
    subDays(parseISO(understanding.dateRange.to), Number(range) - 1),
    "yyyy-MM-dd"
  );
  const signals = understanding.dailySignals.filter(
    (s) => s.date >= cutoff && s.date <= understanding.dateRange.to
  );
  const baselineByMetric = new Map<HealthMetricName, HealthBaseline>(
    understanding.baselines.map((b) => [b.metric, b])
  );

  const metrics = TREND_GROUPS.find((g) => g.group === group)?.metrics ?? [];
  const charts = metrics
    .map((metric) => {
      const display = METRIC_DISPLAY[metric];
      if (!display) return null;
      const data = metricSeries(signals, metric);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-heading">Your patterns over time</h2>
        <div
          role="group"
          aria-label="Trend date range"
          className="border-border bg-card inline-flex rounded-full border p-1"
        >
          {["7", "30", "90"].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => setRange(days)}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-medium transition-colors",
                range === days ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {format(parseISO(cutoff), "MMM d")} –{" "}
        {format(parseISO(understanding.dateRange.to), "MMM d, yyyy")}. Missing readings are not
        counted as zero.
      </p>
      {/* Group chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TREND_GROUPS.map(({ group: g }) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
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
            <Button variant="outline" asChild className="mt-4">
              <Link href="/settings">Manage connections</Link>
            </Button>
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
