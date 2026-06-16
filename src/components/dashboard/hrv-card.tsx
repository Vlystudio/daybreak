"use client";

import { HeartPulse } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthMetric } from "@/lib/types";

export function HrvCard({ today, metrics }: { today: HealthMetric | null; metrics: HealthMetric[] }) {
  const data = metrics
    .filter((m) => m.hrv_avg != null)
    .slice(-14)
    .map((m) => ({
      day: format(parseISO(m.date), "MMM d"),
      hrv: Math.round(m.hrv_avg ?? 0),
    }));

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4 text-sage" aria-hidden />
          HRV
        </CardTitle>
        {today?.hrv_avg != null && (
          <span className="text-2xl font-semibold tabular-nums">
            {Math.round(today.hrv_avg)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
          </span>
        )}
      </CardHeader>
      <CardContent className="pb-6">
        {data.length > 1 ? (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sage)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--sage)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  formatter={(value) => [`${value} ms`, "HRV"]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hrv"
                  stroke="var(--sage)"
                  strokeWidth={2.5}
                  fill="url(#hrvFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Your HRV trend will appear after a couple of nights of Oura data.
          </p>
        )}
        {today?.resting_hr != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            Resting heart rate: {Math.round(today.resting_hr)} bpm
          </p>
        )}
      </CardContent>
    </Card>
  );
}
