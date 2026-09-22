"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TrendPoint {
  day: string;
  date?: string;
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
  const gradId = useId().replace(/:/g, "");
  const reduce = useReducedMotion();

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        {latest != null && (
          <span className="text-xl font-semibold tabular-nums">
            {format(latest)}
            {unit && <span className="text-muted-foreground ml-1 text-xs font-normal">{unit}</span>}
          </span>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        {data.length > 1 ? (
          <div
            className="h-36"
            role="img"
            aria-label={`${title}, ${data.length} readings. Exact values follow below.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  tick={{ fill: "var(--muted-foreground)" }}
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  domain={["auto", "auto"]}
                  width={34}
                />
                <Tooltip
                  formatter={(value) => [
                    `${format(Number(value))}${unit ? ` ${unit}` : ""}`,
                    title,
                  ]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                />
                <Area
                  isAnimationActive={!reduce}
                  animationDuration={300}
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.5}
                  fill={`url(#${gradId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground py-7 text-center text-xs">Not enough data yet.</p>
        )}
        {baseline != null && data.length > 1 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Personal baseline {format(baseline)}
            {unit ? ` ${unit}` : ""}
          </p>
        )}
        {data.length > 0 && (
          <details className="border-border/60 mt-2 border-t">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-xs font-medium">
              View readings{" "}
              <span className="text-muted-foreground">Latest: {data.at(-1)?.day}</span>
            </summary>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <caption className="sr-only">
                  {title} readings{unit ? ` in ${unit}` : ""}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2">
                      Date
                    </th>
                    <th scope="col" className="text-right">
                      {title}
                      {unit ? ` (${unit})` : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point) => (
                    <tr key={point.date ?? point.day} className="border-border/50 border-t">
                      <th scope="row" className="py-2 font-normal">
                        {point.date ?? point.day}
                      </th>
                      <td className="text-right">{format(point.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
