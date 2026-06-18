import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWeeklyPlan, type PlanBlockType } from "@/lib/integrations/ai";
import { fetchWeather } from "@/lib/integrations/weather";
import { generateWorkoutForUser } from "@/lib/workout-engine";
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
  plan_type: string;
};

interface DayMetric {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
  bedtime_start: string | null;
  bedtime_end: string | null;
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
    .select("date, readiness_score, sleep_score, bedtime_start, bedtime_end")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(10)
    .returns<DayMetric[]>();
  const metricsByDate = new Map((metrics ?? []).map((m) => [m.date, m]));
  const latestMetric = (metrics ?? [])[0] ?? null;

  // Day window the planner schedules within. Prefer the wearable's most recent
  // actual sleep/wake; fall back to the user's goal times; then sane defaults.
  const latestSleep = (metrics ?? []).find((m) => m.bedtime_end || m.bedtime_start) ?? null;
  const actualWake = latestSleep?.bedtime_end ? localTime(latestSleep.bedtime_end, tz) : null;
  const actualSleep = latestSleep?.bedtime_start ? localTime(latestSleep.bedtime_start, tz) : null;
  const dayWindow = {
    wake: actualWake ?? prefs.wake_time ?? "07:00",
    sleep: actualSleep ?? prefs.sleep_time ?? "22:30",
    source: actualWake || actualSleep ? "wearable" : prefs.wake_time || prefs.sleep_time ? "goal" : "default",
  };

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
  let todayWorkoutAccepted = false;

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
      dayWindow,
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
        plan_type: b.type,
      });
      if (d.date === todayStr && b.type === "workout") todayWorkoutAccepted = true;
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

  // Wire today's workout block to a real structured session (one per day).
  if (todayWorkoutAccepted) {
    try {
      const ds = zonedToUtc(todayStr, "00:00", tz);
      const de = new Date(ds.getTime() + 86_400_000);
      const { data: workoutEvent } = await admin
        .from("schedule_events")
        .select("id")
        .eq("user_id", userId)
        .eq("source", "plan")
        .eq("plan_type", "workout")
        .gte("starts_at", ds.toISOString())
        .lt("starts_at", de.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (workoutEvent) {
        const { data: existing } = await admin
          .from("user_workouts")
          .select("id")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>();

        let workoutId = existing?.id ?? null;
        if (!workoutId) {
          const res = await generateWorkoutForUser(userId, { date: todayStr });
          if (res.ok) workoutId = res.workout.id;
        }
        if (workoutId) {
          await admin.from("schedule_events").update({ workout_id: workoutId }).eq("id", workoutEvent.id);
        }
      }
    } catch (err) {
      console.error("[planner] workout link failed:", err instanceof Error ? err.message : "unknown");
    }
  }

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

  const count = await planDays(userId, planningDays(prefs.planning_scope, tz));
  if (count !== null) {
    // Mark today as planned so the hourly job doesn't clobber a manual plan.
    await admin.from("user_preferences").update({ last_planned_date: localToday(tz) }).eq("user_id", userId);
  }
  return count;
}

/** Re-plan only TODAY from fresh data. */
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

/** Manual "Plan today" — (re)build just today now and mark the day planned. */
export async function generateTodayPlanForUser(userId: string): Promise<number | null> {
  const count = await refreshTodayPlanForUser(userId);
  if (count !== null) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle<{ timezone: string }>();
    await admin
      .from("user_preferences")
      .update({ last_planned_date: localToday(profile?.timezone || "UTC") })
      .eq("user_id", userId);
  }
  return count;
}

/**
 * Hourly entry point: refresh today's plan exactly once per local day, only
 * after that day's Oura recovery has been synced. Skips users who have already
 * planned today (manually or earlier) or whose recovery isn't in yet.
 */
export async function maybeRefreshTodayPlanForUser(userId: string): Promise<number | null> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("onboarding_completed, last_planned_date")
    .eq("user_id", userId)
    .maybeSingle<{ onboarding_completed: boolean; last_planned_date: string | null }>();
  if (!prefs || !prefs.onboarding_completed) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";
  const todayStr = localToday(tz);

  if (prefs.last_planned_date === todayStr) return null; // already planned today

  // Only plan once today's recovery has actually landed.
  const { data: metric } = await admin
    .from("health_metrics")
    .select("readiness_score")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .maybeSingle<{ readiness_score: number | null }>();
  if (!metric || metric.readiness_score == null) return null;

  const count = await refreshTodayPlanForUser(userId);
  await admin.from("user_preferences").update({ last_planned_date: todayStr }).eq("user_id", userId);
  return count;
}

const CADENCE_MIN_GAP_DAYS: Record<string, number> = { daily: 1, few_times_week: 3, weekly: 7 };

/**
 * Auto-plan entry point: regenerate the user's whole scope on their chosen
 * cadence (off/daily/few_times_week/weekly), at most once per local day and only
 * when enough days have passed. Deliberately does NOT touch last_planned_date,
 * so the recovery-driven today refresh still sharpens today afterwards.
 */
export async function maybeAutoPlanForUser(userId: string): Promise<number | null> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("onboarding_completed, planning_scope, auto_plan_cadence, last_autoplan_date")
    .eq("user_id", userId)
    .maybeSingle<{
      onboarding_completed: boolean;
      planning_scope: string | null;
      auto_plan_cadence: string | null;
      last_autoplan_date: string | null;
    }>();
  if (!prefs || !prefs.onboarding_completed) return null;

  const cadence = prefs.auto_plan_cadence ?? "off";
  const minGap = CADENCE_MIN_GAP_DAYS[cadence];
  if (!minGap) return null; // "off" or unknown

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";
  const todayStr = localToday(tz);

  if (prefs.last_autoplan_date) {
    if (prefs.last_autoplan_date === todayStr) return null;
    const daysSince = Math.round(
      (Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${prefs.last_autoplan_date}T00:00:00Z`)) / 86_400_000
    );
    if (daysSince < minGap) return null;
  }

  const count = await planDays(userId, planningDays(prefs.planning_scope, tz));
  if (count !== null) {
    await admin.from("user_preferences").update({ last_autoplan_date: todayStr }).eq("user_id", userId);
  }
  return count;
}
