"use client";

import Link from "next/link";
import { Link2, ShieldCheck, AlertCircle, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "@/components/health/health-confidence-badge";
import { metricLabel } from "@/components/health/health-display";
import { latestSignals } from "@/lib/health/fusion";
import type {
  HealthMetricName,
  HealthUnderstandingResult,
  SourceConflict,
} from "@/lib/health/types";

/**
 * Sources is Daybreak being honest about its data: what's connected, how much it
 * covers, where trackers disagree, and which source it trusts per metric — so a
 * "low confidence" number is explained, not scary.
 */

const SOURCE_LABEL: Record<string, string> = {
  oura: "Oura",
  apple_health: "Apple Health",
  apple_watch: "Apple Watch",
  fitbit: "Fitbit",
  manual: "Self-report",
  computed: "Computed",
  unknown: "Unknown",
};

const CONFLICT_TONE: Record<SourceConflict["severity"], string> = {
  minor: "border-l-border",
  moderate: "border-l-honey",
  major: "border-l-destructive",
};

function label(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

export function HealthSources({ understanding }: { understanding: HealthUnderstandingResult }) {
  const { dataQuality, sourceConflicts } = understanding;
  const latest = latestSignals(understanding.dailySignals);

  const trusted = [...latest.values()]
    .filter((s) => s.value != null)
    .sort((a, b) => a.metric.localeCompare(b.metric));

  const coverage = Object.entries(dataQuality.coverageByMetric)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const noSources = !dataQuality.connectedSources.some((s) => s !== "manual");

  return (
    <div className="space-y-4">
      {/* Connected / missing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="text-sage h-4 w-4" aria-hidden /> Connected sources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {dataQuality.connectedSources.map((s) => (
              <Badge key={s} variant="sage">
                {label(s)}
              </Badge>
            ))}
            {dataQuality.missingSources.map((s) => (
              <Badge key={s} variant="outline" className="text-muted-foreground">
                {label(s)} · not connected
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Overall data confidence</span>
            <ConfidenceBadge
              confidence={dataQuality.overallConfidence}
              reasons={dataQuality.warnings}
            />
          </div>
          {noSources && (
            <div className="bg-honey-soft/40 flex flex-col items-start gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Connect a wearable to unlock recovery, sleep, and activity insights.
              </p>
              <Button asChild size="sm">
                <Link href="/settings">
                  <Link2 aria-hidden /> Connect
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflicts */}
      {sourceConflicts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4" aria-hidden /> Where your trackers disagree
          </h2>
          <div className="space-y-2">
            {sourceConflicts.slice(0, 6).map((c, i) => (
              <div
                key={`${c.metric}-${c.date}-${i}`}
                className={cn(
                  "border-border bg-card rounded-xl border border-l-4 p-3.5",
                  CONFLICT_TONE[c.severity]
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium capitalize">{metricLabel(c.metric)}</p>
                  <Badge
                    variant={
                      c.severity === "major"
                        ? "destructive"
                        : c.severity === "moderate"
                          ? "honey"
                          : "outline"
                    }
                  >
                    {c.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{c.message}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Disagreements are normal — different devices measure differently. Daybreak picks the
            best source per metric and lowers confidence rather than averaging them together.
          </p>
        </section>
      )}

      {/* Per-metric trust */}
      {trusted.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-sky h-4 w-4" aria-hidden /> What Daybreak trusts per
              metric
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-border divide-y">
            {trusted.map((s) => (
              <div
                key={s.metric}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-medium capitalize">{metricLabel(s.metric)}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{label(s.primarySource)}</Badge>
                  <ConfidenceBadge confidence={s.confidence} reasons={s.confidenceReasons} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Coverage */}
      {coverage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {coverage.slice(0, 12).map(([metric, frac]) => (
              <div key={metric} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize">{metricLabel(metric as HealthMetricName)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {Math.round(frac * 100)}%
                  </span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-sage h-full rounded-full"
                    style={{ width: `${Math.round(frac * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground pt-1 text-xs">
              Share of days in this range with a value for each metric.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
