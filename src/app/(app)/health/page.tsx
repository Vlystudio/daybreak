import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildDailyHealthUnderstanding } from "@/lib/health/understanding";
import { HealthCommandCenter } from "@/components/health/health-command-center";
import type { CheckinMessage } from "@/actions/health";
import type { SubjectiveCheckin } from "@/lib/types";

const KG_PER_LB = 0.45359237;
const RANGE_DAYS = 120;

export const metadata = { title: "Health · Daybreak" };
export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Date `days` ago — kept out of render so the impurity lint stays happy. */
function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function HealthPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const since = isoDaysAgo(RANGE_DAYS);
  const today = new Date().toISOString().slice(0, 10);

  // The deterministic, source-aware understanding powers Overview/Trends/Sources.
  // Self-report series + conversational check-in feed the Check-in tab.
  const [
    understanding,
    { data: conversation },
    { data: todayCheckin },
    { data: bodyRows },
    { data: foodRows },
    { data: feelingRows },
  ] = await Promise.all([
    buildDailyHealthUnderstanding(user.id, daysAgoDate(RANGE_DAYS), new Date()),
    supabase
      .from("health_checkins")
      .select("id, messages")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; messages: CheckinMessage[] }>(),
    supabase
      .from("subjective_checkins")
      .select("date, mood, energy, stress, soreness, note")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle<SubjectiveCheckin>(),
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
      .select("date, mood, energy, stress")
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true })
      .returns<
        { date: string; mood: number | null; energy: number | null; stress: number | null }[]
      >(),
  ]);

  const weight = (bodyRows ?? []).map((b) => ({
    date: b.date,
    lb: b.weight_kg != null ? Math.round((b.weight_kg / KG_PER_LB) * 10) / 10 : null,
    bodyFat: b.body_fat_pct,
  }));

  const byDay = new Map<string, { calories: number; protein: number }>();
  for (const f of foodRows ?? []) {
    const agg = byDay.get(f.date) ?? { calories: 0, protein: 0 };
    agg.calories += f.calories ?? 0;
    agg.protein += f.protein_g ?? 0;
    byDay.set(f.date, agg);
  }
  const nutrition = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, agg]) => ({
      date,
      calories: Math.round(agg.calories),
      protein: Math.round(agg.protein),
    }));

  const feelings = (feelingRows ?? []).map((f) => ({
    date: f.date,
    mood: f.mood,
    energy: f.energy,
    stress: f.stress,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A source-aware read of your body — what each tracker is best at, and how confident
          Daybreak is.
        </p>
      </div>
      <HealthCommandCenter
        understanding={understanding}
        todayCheckin={todayCheckin ?? null}
        conversation={conversation ?? null}
        selfReport={{ today, weight, nutrition, feelings }}
      />
    </div>
  );
}
