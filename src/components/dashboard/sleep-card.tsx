"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Moon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthMetric } from "@/lib/types";

function fmtDuration(min: number | null): string {
  if (min == null) return "–";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function SleepCard({
  today,
  metrics,
}: {
  today: HealthMetric | null;
  metrics: HealthMetric[];
}) {
  const reduce = useReducedMotion();
  const data = metrics.slice(-7).map((m) => ({
    day: format(parseISO(m.date), "EEE"),
    deep: m.deep_sleep_min ?? 0,
    rem: m.rem_sleep_min ?? 0,
    light: m.light_sleep_min ?? 0,
  }));

  const hasData = data.some((d) => d.deep + d.rem + d.light > 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="text-sky h-4 w-4" aria-hidden />
          Sleep
        </CardTitle>
        {today?.sleep_score != null && (
          <span className="text-2xl font-semibold tabular-nums">{today.sleep_score}</span>
        )}
      </CardHeader>
      <CardContent className="pb-6">
        <div className="mb-3 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Last night</span>
          <span className="font-medium">{fmtDuration(today?.sleep_duration_min ?? null)}</span>
        </div>
        {hasData ? (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                <XAxis
                  tick={{ fill: "var(--muted-foreground)" }}
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  formatter={(value, name) => [fmtDuration(Number(value)), String(name)]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                />
                <Bar
                  isAnimationActive={!reduce}
                  animationDuration={300}
                  dataKey="deep"
                  name="Deep"
                  stackId="sleep"
                  fill="var(--sky)"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  isAnimationActive={!reduce}
                  animationDuration={300}
                  dataKey="rem"
                  name="REM"
                  stackId="sleep"
                  fill="var(--sage)"
                />
                <Bar
                  isAnimationActive={!reduce}
                  animationDuration={300}
                  dataKey="light"
                  name="Light"
                  stackId="sleep"
                  fill="var(--peach)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Sleep stages appear when your connected tracker shares them.
            <Link
              href="/settings"
              className="text-primary mt-2 block min-h-11 py-3 font-medium underline"
            >
              Manage connections
            </Link>
          </p>
        )}
        {hasData && (
          <div className="text-muted-foreground mt-3 flex flex-wrap justify-center gap-3 text-xs">
            {[
              ["Deep", "var(--sky)"],
              ["REM", "var(--sage)"],
              ["Light", "var(--peach)"],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
            <Link href="/health" className="text-primary min-h-11 py-3 underline">
              Explore health trends
            </Link>
          </div>
        )}
        {today?.sleep_efficiency != null && (
          <p className="text-muted-foreground mt-3 text-sm">
            {today.sleep_efficiency}% efficiency last night
          </p>
        )}
      </CardContent>
    </Card>
  );
}
