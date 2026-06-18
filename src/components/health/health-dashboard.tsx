"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  Activity,
  Moon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion";
import { TrendChart } from "@/components/health/trend-chart";
import { metricStat, type HeadsUp, type HeadsUpSeverity, type MetricKey } from "@/lib/health-insights";
import { syncNow } from "@/actions/settings";
import { analyzeHealth } from "@/actions/health";
import type { HealthAnalysis } from "@/lib/integrations/ai";
import type { HealthMetric } from "@/lib/types";

const RANGES = [7, 30, 90] as const;

const CHARTS: {
  key: MetricKey;
  title: string;
  color: string;
  unit?: string;
  transform?: (n: number) => number;
  format?: (n: number) => string;
}[] = [
  { key: "readiness_score", title: "Readiness", color: "var(--primary)" },
  { key: "sleep_score", title: "Sleep score", color: "var(--sky)" },
  { key: "hrv_avg", title: "HRV", color: "var(--sage)", unit: "ms" },
  { key: "resting_hr", title: "Resting HR", color: "var(--peach)", unit: "bpm" },
  {
    key: "sleep_duration_min",
    title: "Sleep",
    color: "var(--sky)",
    unit: "h",
    transform: (n) => n / 60,
    format: (n) => n.toFixed(1),
  },
  { key: "sleep_efficiency", title: "Sleep efficiency", color: "var(--sage)", unit: "%" },
  {
    key: "body_temperature_delta",
    title: "Body temperature",
    color: "var(--honey)",
    unit: "°C",
    format: (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1)),
  },
];

const SEV_STYLE: Record<HeadsUpSeverity, string> = {
  alert: "border-l-destructive bg-destructive/5",
  watch: "border-l-honey bg-honey-soft/40",
  good: "border-l-sage bg-sage-soft/40",
};
const SEV_ICON: Record<HeadsUpSeverity, typeof Info> = {
  alert: AlertTriangle,
  watch: Info,
  good: CheckCircle2,
};
const SEV_COLOR: Record<HeadsUpSeverity, string> = {
  alert: "text-destructive",
  watch: "text-honey",
  good: "text-sage",
};

export function HealthDashboard({
  metrics,
  flags,
  hasOura,
}: {
  metrics: HealthMetric[];
  flags: HeadsUp[];
  hasOura: boolean;
}) {
  const router = useRouter();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [syncing, startSync] = useTransition();

  const lastDate = metrics.at(-1)?.date ?? null;
  const rangeMetrics = metrics.slice(-range);

  function sync() {
    startSync(async () => {
      const res = await syncNow();
      if (res.ok) {
        toast.success("Synced your latest data.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function analyze() {
    startAnalyze(async () => {
      const res = await analyzeHealth();
      if (res.ok) setAnalysis(res.analysis);
      else toast.error(res.error);
    });
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No health data yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {hasOura
              ? "Your Oura ring is connected — metrics will appear here after it syncs a night of data."
              : "Connect your Oura ring to start tracking readiness, sleep, HRV and more."}
          </p>
          {!hasOura && (
            <Button asChild>
              <Link href="/settings">Connect Oura</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const stageData = rangeMetrics
    .filter((m) => m.deep_sleep_min != null || m.rem_sleep_min != null || m.light_sleep_min != null)
    .map((m) => ({
      day: format(parseISO(m.date), "MMM d"),
      Deep: Math.round(((m.deep_sleep_min ?? 0) / 60) * 10) / 10,
      REM: Math.round(((m.rem_sleep_min ?? 0) / 60) * 10) / 10,
      Light: Math.round(((m.light_sleep_min ?? 0) / 60) * 10) / 10,
    }));

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                range === r ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastDate && (
            <span className="text-xs text-muted-foreground">
              Through {format(parseISO(lastDate), "MMM d")}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </div>

      {/* Heads-up */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Heads up</h2>
        {flags.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Nothing jumping out — your trends look steady. Keep it up.
            </CardContent>
          </Card>
        ) : (
          <Stagger className="space-y-2">
            {flags.map((f) => {
              const Icon = SEV_ICON[f.severity];
              return (
                <StaggerItem key={f.id}>
                  <div className={cn("rounded-xl border border-l-4 border-border p-3", SEV_STYLE[f.severity])}>
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEV_COLOR[f.severity])} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{f.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{f.detail}</p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      {/* AI analysis */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-honey" aria-hidden /> What your body&apos;s telling you
          </CardTitle>
          <Button variant="secondary" size="sm" onClick={analyze} disabled={analyzing}>
            {analyzing ? "Analyzing…" : analysis ? "Refresh" : "Analyze"}
          </Button>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              <p className="text-sm">{analysis.summary}</p>
              {analysis.insights.length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {analysis.insights.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              )}
              {analysis.suggestions.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.suggestions.map((s, idx) => (
                    <div key={idx} className="rounded-xl bg-muted/50 p-3">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Get an AI read of the last 30 days — patterns across sleep, recovery, and heart-rate trends.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Trends */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Trends</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHARTS.map((c) => {
            const stat = metricStat(metrics, c.key);
            const tf = c.transform ?? ((n: number) => n);
            const data = rangeMetrics
              .filter((m) => typeof m[c.key] === "number")
              .map((m) => ({ day: format(parseISO(m.date), "MMM d"), value: tf(m[c.key] as number) }));
            return (
              <TrendChart
                key={c.key}
                title={c.title}
                color={c.color}
                unit={c.unit}
                data={data}
                latest={stat.latest != null ? tf(stat.latest) : null}
                baseline={stat.avg30 != null ? tf(stat.avg30) : null}
                format={c.format}
              />
            );
          })}
        </div>
      </section>

      {/* Sleep stages */}
      {stageData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-4 w-4 text-sky" aria-hidden /> Sleep stages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stageData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} unit="h" />
                  <Tooltip
                    formatter={(value, name) => [`${value} h`, name]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Deep" stackId="1" stroke="var(--sky)" fill="var(--sky)" fillOpacity={0.7} />
                  <Area type="monotone" dataKey="REM" stackId="1" stroke="var(--sage)" fill="var(--sage)" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Light" stackId="1" stroke="var(--honey)" fill="var(--honey)" fillOpacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Daybreak surfaces general wellness patterns, not medical advice. For anything that concerns you, talk
        to a healthcare professional.
      </p>
    </div>
  );
}
