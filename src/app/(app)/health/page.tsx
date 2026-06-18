import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeHeadsUp } from "@/lib/health-insights";
import { HealthDashboard } from "@/components/health/health-dashboard";
import type { HealthMetric } from "@/lib/types";

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

  const [{ data: metrics }, { data: connections }] = await Promise.all([
    supabase
      .from("health_metrics")
      .select(
        "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, activity_balance, body_temperature_delta"
      )
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true })
      .returns<HealthMetric[]>(),
    supabase.rpc("my_connections"),
  ]);

  const m = metrics ?? [];
  const hasOura =
    Array.isArray(connections) && (connections as { provider?: string }[]).some((c) => c?.provider === "oura");
  const flags = computeHeadsUp(m);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Oura data, the trends behind it, and what it means — in one place.
        </p>
      </div>
      <HealthDashboard metrics={m} flags={flags} hasOura={hasOura} />
    </div>
  );
}
