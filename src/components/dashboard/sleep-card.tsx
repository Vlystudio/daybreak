"use client";

import { Moon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthMetric } from "@/lib/types";

function fmtDuration(min: number | null): string {
  if (min == null) return "–";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function SleepCard({ today, metrics }: { today: HealthMetric | null; metrics: HealthMetric[] }) {
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
          <Moon className="h-4 w-4 text-sky" aria-hidden />
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
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
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
                <Bar dataKey="deep" name="Deep" stackId="sleep" fill="var(--sky)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="rem" name="REM" stackId="sleep" fill="var(--sage)" />
                <Bar dataKey="light" name="Light" stackId="sleep" fill="var(--peach)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sleep stages will appear here once Oura is connected.
          </p>
        )}
        {today?.sleep_efficiency != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            {today.sleep_efficiency}% efficiency last night
          </p>
        )}
      </CardContent>
    </Card>
  );
}
