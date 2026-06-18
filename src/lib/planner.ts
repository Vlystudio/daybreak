import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWeeklyPlan, type PlanBlockType } from "@/lib/integrations/ai";
import { audit } from "@/lib/audit";
import type { UserPreferences } from "@/lib/planning";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Milliseconds to add to a UTC instant to get the wall-clock in `timeZone`. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** Interpret `date`+`time` as wall-clock in `timeZone` and return the UTC instant. */
function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(timeZone, guess));
}

function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  );
}

function localTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso)
  );
}

function planningDays(scope: string | null, timeZone: string): { date: string; weekday: string }[] {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const base = new Date(`${todayStr}T12:00:00Z`); // noon avoids date rollover when adding days
  const count = scope === "few_days" ? 3 : 7;

  const days: { date: string; weekday: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    const dow = d.getUTCDay();
    if (scope === "weekends" && dow !== 0 && dow !== 6) continue;
    days.push({ date: d.toISOString().slice(0, 10), weekday: WEEKDAYS[dow] });
  }
  return days;
}

const COLOR_BY_TYPE: Record<PlanBlockType, "honey" | "sage" | "sky" | "peach"> = {
  workout: "sage",
  wind_down: "sage",
  chore: "peach",
  errand: "peach",
  hobby: "sky",
  social: "sky",
  meal: "honey",
  focus: "honey",
};

/**
 * Generate an AI plan for the user and write it into schedule_events as
 * `source = 'plan'`, replacing any existing plan rows in the window. Returns
 * the number of blocks created, or null if the user hasn't onboarded / AI is off.
 */
export async function generatePlanForUser(userId: string): Promise<number | null> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserPreferences>();
  if (!prefs || !prefs.onboarding_completed) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";

  const days = planningDays(prefs.planning_scope, tz);
  if (days.length === 0) return null;

  const windowStart = zonedToUtc(days[0].date, "00:00", tz);
  const windowEnd = new Date(zonedToUtc(days[days.length - 1].date, "00:00", tz).getTime() + 86_400_000);

  const { data: fixed } = await admin
    .from("schedule_events")
    .select("title, starts_at, ends_at")
    .eq("user_id", userId)
    .in("source", ["manual", "google"])
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString())
    .returns<{ title: string; starts_at: string; ends_at: string }[]>();

  const busy = (fixed ?? []).map((e) => ({
    date: localDate(e.starts_at, tz),
    start: localTime(e.starts_at, tz),
    end: localTime(e.ends_at, tz),
    title: e.title,
  }));

  const { data: metrics } = await admin
    .from("health_metrics")
    .select("date, readiness_score, sleep_score")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(3)
    .returns<{ date: string; readiness_score: number | null; sleep_score: number | null }[]>();
  const recent = (metrics ?? []).map((m) => ({
    date: m.date,
    readiness: m.readiness_score,
    sleep: m.sleep_score,
  }));

  const blocks = await generateWeeklyPlan({
    preferences: {
      work_type: prefs.work_type,
      work_title: prefs.work_title,
      work_schedule: prefs.work_schedule,
      fitness_goal: prefs.fitness_goal,
      activity_level: prefs.activity_level,
      exercise_frequency: prefs.exercise_frequency,
      hobbies: prefs.hobbies,
      social_tendency: prefs.social_tendency,
      chores: prefs.chores,
      dietary_restrictions: prefs.dietary_restrictions,
      planning_scope: prefs.planning_scope,
    },
    days,
    busy,
    recent,
  });
  if (!blocks) return null;

  const rows = blocks.map((b) => {
    const start = zonedToUtc(b.date, b.start, tz);
    const end = new Date(start.getTime() + b.durationMin * 60_000);
    return {
      user_id: userId,
      title: b.title.slice(0, 200),
      description: b.note ? b.note.slice(0, 2000) : null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      source: "plan" as const,
      color: COLOR_BY_TYPE[b.type] ?? "honey",
    };
  });

  const { error: delErr } = await admin
    .from("schedule_events")
    .delete()
    .eq("user_id", userId)
    .eq("source", "plan")
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString());
  if (delErr) throw new Error(`Plan cleanup failed: ${delErr.message}`);

  if (rows.length > 0) {
    const { error } = await admin.from("schedule_events").insert(rows);
    if (error) throw new Error(`Plan insert failed: ${error.message}`);
  }

  await audit(userId, "plan.generated", { metadata: { blocks: rows.length } });
  return rows.length;
}
