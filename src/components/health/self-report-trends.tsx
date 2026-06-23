"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendChart, type TrendPoint } from "@/components/health/trend-chart";

export interface WeightPoint {
  date: string;
  lb: number | null;
  bodyFat: number | null;
}
export interface NutritionPoint {
  date: string;
  calories: number | null;
  protein: number | null;
}
export interface FeelingPoint {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
}

const RANGES = [30, 90] as const;

export function SelfReportTrends({
  today,
  weight,
  nutrition,
  feelings,
}: {
  today: string; // YYYY-MM-DD reference day, from the server
  weight: WeightPoint[];
  nutrition: NutritionPoint[];
  feelings: FeelingPoint[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const cutoff = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - range);
    return d.toISOString().slice(0, 10);
  }, [today, range]);

  function series<T extends { date: string }>(rows: T[], pick: (r: T) => number | null): TrendPoint[] {
    return rows
      .filter((r) => r.date >= cutoff && pick(r) != null)
      .map((r) => ({ day: format(parseISO(r.date), "MMM d"), value: pick(r) as number }));
  }

  const charts: {
    title: string;
    color: string;
    unit?: string;
    data: TrendPoint[];
    format?: (n: number) => string;
  }[] = [
    { title: "Weight", color: "var(--sage)", unit: "lb", data: series(weight, (r) => r.lb), format: (n: number) => n.toFixed(1) },
    { title: "Body fat", color: "var(--peach)", unit: "%", data: series(weight, (r) => r.bodyFat), format: (n: number) => n.toFixed(1) },
    { title: "Calories", color: "var(--primary)", unit: "kcal", data: series(nutrition, (r) => r.calories) },
    { title: "Protein", color: "var(--honey)", unit: "g", data: series(nutrition, (r) => r.protein) },
    { title: "Mood", color: "var(--primary)", data: series(feelings, (r) => r.mood), format: (n: number) => n.toFixed(1) },
    { title: "Energy", color: "var(--sage)", data: series(feelings, (r) => r.energy), format: (n: number) => n.toFixed(1) },
    { title: "Stress", color: "var(--peach)", data: series(feelings, (r) => r.stress), format: (n: number) => n.toFixed(1) },
  ].filter((c) => c.data.length > 0);

  if (charts.length === 0) return null;

  function avg(data: TrendPoint[]): number {
    return data.reduce((s, p) => s + p.value, 0) / data.length;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <LineChart className="h-4 w-4" aria-hidden /> What you log
        </h2>
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {charts.map((c) => (
          <TrendChart
            key={c.title}
            title={c.title}
            color={c.color}
            unit={c.unit}
            data={c.data}
            latest={c.data.length ? c.data[c.data.length - 1].value : null}
            baseline={range === 30 && c.data.length > 1 ? avg(c.data) : null}
            format={c.format}
          />
        ))}
      </div>
    </section>
  );
}
