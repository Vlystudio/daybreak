import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWeeklyPlan, type PlanBlockType } from "@/lib/integrations/ai";
import { fetchWeather } from "@/lib/integrations/weather";
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

function localToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function planningDays(scope: string | null, timeZone: string): { date: string; weekday: string }[] {
  const base = new Date(`${localToday(timeZone)}T12:00:00Z`); // noon avoids date rollover when adding days
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

// Plan blocks use warm colors so they're visually distinct from Google
// events (which sync as "sky"/blue).
const COLOR_BY_TYPE: Record<PlanBlockType, "honey" | "sage" | "sky" | "peach"> = {
  workout: "sage",
  wind_down: "sage",
  chore: "peach",
  errand: "peach",
  hobby: "honey",
  social: "peach",
  meal: "honey",
  focus: "honey",
};

function overlaps(s: number, e: number, intervals: [number, number][]): boolean {
  return intervals.some(([bs, be]) => s < be && e > bs);
}

type PlanRow = {
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  source: "plan";
  color: "honey" | "sage" | "sky" | "peach";
};

interface DayMetric {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
}

/**
 * Plan each given day individually using THAT day's recovery and (for today)
 * the weather, then write the blocks as schedule_events with source='plan'.
 * Each regenerated day's plan rows are replaced; manual/Google events and plan
 * rows on other days are untouched. Returns total blocks created, or null if
 * the user hasn't onboarded.
 */
async function planDays(
  userId: string,
  dateList: { date: string; weekday: string }[]
): Promise<number | null> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserPreferences>();
  if (!prefs || !prefs.onboarding_completed) return null;
  if (dateList.length === 0) return 0;

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone, latitude, longitude")
    .eq("id", userId)
    .maybeSingle<{ timezone: string; latitude: number | null; longitude: number | null }>();
  const tz = profile?.timezone || "UTC";

  const sorted = [...dateList].sort((a, b) => a.date.localeCompare(b.date));
  const winStart = zonedToUtc(sorted[0].date, "00:00", tz);
  const winEnd = new Date(zonedToUtc(sorted[sorted.length - 1].date, "00:00", tz).getTime() + 86_400_000);

  const { data: fixed } = await admin
    .from("schedule_events")
    .select("title, starts_at, ends_at")
    .eq("user_id", userId)
    .in("source", ["manual", "google"])
    .gte("starts_at", winStart.toISOString())
    .lt("starts_at", winEnd.toISOString())
    .returns<{ title: string; starts_at: string; ends_at: string }[]>();

  const { data: metrics } = await admin
    .from("health_metrics")
    .select("date, readiness_score, sleep_score")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(10)
    .returns<DayMetric[]>();
  const metricsByDate = new Map((metrics ?? []).map((m) => [m.date, m]));
  const latestMetric = (metrics ?? [])[0] ?? null;

  const todayStr = localToday(tz);
  const lat = profile?.latitude;
  const lon = profile?.longitude;
  const weatherToday =
    dateList.some((d) => d.date === todayStr) && lat != null && lon != null
      ? await fetchWeather(lat, lon)
      : null;

  const workDays = prefs.work_days ?? [];
  const workStart = prefs.work_start_time;
  const workEnd = prefs.work_end_time;

  const preferences = {
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
  };

  const allRows: PlanRow[] = [];
  const clearDates: string[] = [];

  for (const d of dateList) {
    const isWorkDay = workDays.includes(d.weekday);
    const workBusy =
      workStart && workEnd && isWorkDay
        ? [{ date: d.date, start: workStart, end: workEnd, title: "Work" }]
        : [];
    const dayFixed = (fixed ?? []).filter((e) => localDate(e.starts_at, tz) === d.date);
    const busyForDay = [
      ...dayFixed.map((e) => ({
        date: d.date,
        start: localTime(e.starts_at, tz),
        end: localTime(e.ends_at, tz),
        title: e.title,
      })),
      ...workBusy,
    ];

    const dm = metricsByDate.get(d.date) ?? latestMetric;
    const recent = dm ? [{ date: d.date, readiness: dm.readiness_score, sleep: dm.sleep_score }] : [];
    const weather = d.date === todayStr ? weatherToday : null;

    const blocks = await generateWeeklyPlan({
      preferences,
      days: [d],
      busy: busyForDay,
      recent,
      weather: weather
        ? {
            description: weather.description,
            temperature: weather.temperature,
            high: weather.tempMax,
            low: weather.tempMin,
            precipitationChance: weather.precipitationChance,
          }
        : null,
    });
    if (!blocks) continue;

    const busyIntervals: [number, number][] = [
      ...dayFixed.map(
        (e) => [new Date(e.starts_at).getTime(), new Date(e.ends_at).getTime()] as [number, number]
      ),
      ...workBusy.map(
        (w) =>
          [zonedToUtc(w.date, w.start, tz).getTime(), zonedToUtc(w.date, w.end, tz).getTime()] as [
            number,
            number,
          ]
      ),
    ];

    const accepted: [number, number][] = [];
    for (const b of blocks) {
      const start = zonedToUtc(b.date, b.start, tz);
      const startMs = start.getTime();
      const endMs = startMs + b.durationMin * 60_000;
      if (overlaps(startMs, endMs, busyIntervals)) continue;
      if (overlaps(startMs, endMs, accepted)) continue;
      accepted.push([startMs, endMs]);
      allRows.push({
        user_id: userId,
        title: b.title.slice(0, 200),
        description: b.note ? b.note.slice(0, 2000) : null,
        starts_at: start.toISOString(),
        ends_at: new Date(endMs).toISOString(),
        all_day: false,
        source: "plan",
        color: COLOR_BY_TYPE[b.type] ?? "honey",
      });
    }
    clearDates.push(d.date);
  }

  // Replace plan rows only for the days we regenerated.
  for (const date of clearDates) {
    const ds = zonedToUtc(date, "00:00", tz);
    const de = new Date(ds.getTime() + 86_400_000);
    const { error } = await admin
      .from("schedule_events")
      .delete()
      .eq("user_id", userId)
      .eq("source", "plan")
      .gte("starts_at", ds.toISOString())
      .lt("starts_at", de.toISOString());
    if (error) throw new Error(`Plan cleanup failed: ${error.message}`);
  }

  if (allRows.length > 0) {
    const { error } = await admin.from("schedule_events").insert(allRows);
    if (error) throw new Error(`Plan insert failed: ${error.message}`);
  }

  await audit(userId, "plan.generated", { metadata: { days: dateList.length, blocks: allRows.length } });
  return allRows.length;
}

/** Generate the plan for the user's whole scope window (manual "Generate"). */
export async function generatePlanForUser(userId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("planning_scope, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle<{ planning_scope: string | null; onboarding_completed: boolean }>();
  if (!prefs || !prefs.onboarding_completed) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";

  return planDays(userId, planningDays(prefs.planning_scope, tz));
}

/** Re-plan only TODAY from fresh data — called each morning after Oura sync. */
export async function refreshTodayPlanForUser(userId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";

  const todayStr = localToday(tz);
  const dow = new Date(`${todayStr}T12:00:00Z`).getUTCDay();
  return planDays(userId, [{ date: todayStr, weekday: WEEKDAYS[dow] }]);
}
