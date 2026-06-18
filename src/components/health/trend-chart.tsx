"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TrendPoint {
  day: string;
  value: number;
}

/** Compact sparkline-style trend for one health metric. */
export function TrendChart({
  title,
  color,
  unit,
  data,
  latest,
  baseline,
  format = (n) => String(Math.round(n)),
}: {
  title: string;
  color: string; // a CSS var, e.g. "var(--sage)"
  unit?: string;
  data: TrendPoint[];
  latest: number | null;
  baseline: number | null;
  format?: (n: number) => string;
}) {
  const gradId = `grad-${title.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {latest != null && (
          <span className="text-xl font-semibold tabular-nums">
            {format(latest)}
            {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
          </span>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        {data.length > 1 ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: -30 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} domain={["auto", "auto"]} width={34} />
                <Tooltip
                  formatter={(value) => [`${format(Number(value))}${unit ? ` ${unit}` : ""}`, title]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-7 text-center text-xs text-muted-foreground">Not enough data yet.</p>
        )}
        {baseline != null && data.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            30-day avg {format(baseline)}
            {unit ? ` ${unit}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
