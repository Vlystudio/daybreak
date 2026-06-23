import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeHeadsUp } from "@/lib/health-insights";
import { computeInsights, type DailyRecord } from "@/lib/insights";
import { HealthDashboard } from "@/components/health/health-dashboard";
import { SelfReportTrends } from "@/components/health/self-report-trends";
import { InsightsCard } from "@/components/health/insights-card";
import type { CheckinMessage } from "@/actions/health";
import type { HealthMetric } from "@/lib/types";

const KG_PER_LB = 0.45359237;

export const metadata = { title: "Health · Daybreak" };
export const dynamic = "force-dynamic";

/** ISO date (YYYY-MM-DD) for `days` ago — kept out of render so it stays pure. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function HealthPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const since = isoDaysAgo(120);

  const [
    { data: metrics },
    { data: connections },
    { data: checkin },
    { data: bodyRows },
    { data: foodRows },
    { data: feelingRows },
    { data: habitLogRows },
  ] = await Promise.all([
    supabase
      .from("health_metrics")
      .select(
        "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, activity_balance, body_temperature_delta, steps, active_calories, total_calories, activity_score, spo2_avg, respiratory_rate, stress_high_min, recovery_high_min, resilience_level"
      )
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true })
      .returns<HealthMetric[]>(),
    supabase.rpc("my_connections"),
    supabase
      .from("health_checkins")
      .select("id, messages")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; messages: CheckinMessage[] }>(),
    supabase
      .from("body_measurements")
      .select("date, weight_kg, body_fat_pct")
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true })
      .returns<{ date: string; weight_kg: number | null; body_fat_pct: number | null }[]>(),
    supabase
      .from("food_logs")
      .select("date, calories, protein_g")
      .eq("user_id", user.id)
      .gte("date", since)
      .returns<{ date: string; calories: number | null; protein_g: number | null }[]>(),
    supabase
      .from("subjective_checkins")
      .select("date, mood, energy, stress, soreness")
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true })
      .returns<{ date: string; mood: number | null; energy: number | null; stress: number | null; soreness: number | null }[]>(),
    supabase
      .from("habit_logs")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", since)
      .returns<{ date: string }[]>(),
  ]);

  const m = metrics ?? [];
  const hasOura =
    Array.isArray(connections) && (connections as { provider?: string }[]).some((c) => c?.provider === "oura");
  const flags = computeHeadsUp(m);

  const weightSeries = (bodyRows ?? []).map((b) => ({
    date: b.date,
    lb: b.weight_kg != null ? Math.round((b.weight_kg / KG_PER_LB) * 10) / 10 : null,
    bodyFat: b.body_fat_pct,
  }));

  // Sum food logs per day into calorie/protein totals.
  const byDay = new Map<string, { calories: number; protein: number }>();
  for (const f of foodRows ?? []) {
    const agg = byDay.get(f.date) ?? { calories: 0, protein: 0 };
    agg.calories += f.calories ?? 0;
    agg.protein += f.protein_g ?? 0;
    byDay.set(f.date, agg);
  }
  const nutritionSeries = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, agg]) => ({ date, calories: Math.round(agg.calories), protein: Math.round(agg.protein) }));

  const feelingSeries = (feelingRows ?? []).map((f) => ({
    date: f.date,
    mood: f.mood,
    energy: f.energy,
    stress: f.stress,
  }));

  // Assemble one record per day across every signal, then mine for patterns.
  const habitsByDay = new Map<string, number>();
  for (const h of habitLogRows ?? []) habitsByDay.set(h.date, (habitsByDay.get(h.date) ?? 0) + 1);
  const feelingByDay = new Map((feelingRows ?? []).map((f) => [f.date, f]));
  const nutritionByDay = new Map(nutritionSeries.map((n) => [n.date, n]));

  const dailyRecords: DailyRecord[] = m.map((d) => {
    const feel = feelingByDay.get(d.date);
    const nut = nutritionByDay.get(d.date);
    return {
      date: d.date,
      readiness: d.readiness_score,
      sleep_score: d.sleep_score,
      hrv: d.hrv_avg,
      resting_hr: d.resting_hr,
      steps: d.steps,
      mood: feel?.mood ?? null,
      energy: feel?.energy ?? null,
      stress: feel?.stress ?? null,
      soreness: feel?.soreness ?? null,
      calories: nut?.calories ?? null,
      protein: nut?.protein ?? null,
      habitsDone: habitsByDay.get(d.date) ?? null,
    };
  });
  // Include days that have self-reports but no wearable metrics.
  const haveDates = new Set(m.map((d) => d.date));
  for (const f of feelingRows ?? []) {
    if (haveDates.has(f.date)) continue;
    const nut = nutritionByDay.get(f.date);
    dailyRecords.push({
      date: f.date, readiness: null, sleep_score: null, hrv: null, resting_hr: null, steps: null,
      mood: f.mood, energy: f.energy, stress: f.stress, soreness: f.soreness,
      calories: nut?.calories ?? null, protein: nut?.protein ?? null, habitsDone: habitsByDay.get(f.date) ?? null,
    });
  }
  const insights = computeInsights(dailyRecords);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Oura data, the trends behind it, and what it means — in one place.
        </p>
      </div>
      <HealthDashboard metrics={m} flags={flags} hasOura={hasOura} checkin={checkin ?? null} />
      <InsightsCard insights={insights} />
      <SelfReportTrends
        today={new Date().toISOString().slice(0, 10)}
        weight={weightSeries}
        nutrition={nutritionSeries}
        feelings={feelingSeries}
      />
    </div>
  );
}
