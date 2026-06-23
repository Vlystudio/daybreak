import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeather, type WeatherSnapshot } from "@/lib/integrations/weather";
import { computeHabitStatus } from "@/lib/habits";
import type {
  Profile,
  HealthMetric,
  DailySummary,
  ScheduleEvent,
  Connection,
  HouseholdInfo,
  CalendarSyncSettings,
  SubjectiveCheckin,
  EveningReview,
  Habit,
  HabitStatus,
} from "@/lib/types";

export interface DashboardData {
  profile: Profile | null;
  metrics: HealthMetric[]; // last 14 days ascending
  today: HealthMetric | null;
  summary: DailySummary | null;
  todayEvents: ScheduleEvent[];
  householdEvents: ScheduleEvent[];
  household: HouseholdInfo | null;
  connections: Connection[];
  weather: WeatherSnapshot | null;
  calendarSync: CalendarSyncSettings | null;
  onboardingCompleted: boolean;
  adherence: { total: number; done: number; streak: number };
  todayCheckin: SubjectiveCheckin | null;
  todayNutrition: { calories: number; protein: number; count: number } | null;
  todayReview: EveningReview | null;
  habits: HabitStatus[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Loads everything the dashboard needs in one place. All queries run as the
 * signed-in user through RLS; household member names are resolved with the
 * admin client but only for the household the user belongs to.
 */
export async function loadDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const todayStr = isoDate(new Date());
  const twoWeeksAgo = isoDate(new Date(Date.now() - 14 * 86_400_000));
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [
    { data: profile },
    { data: metrics },
    { data: summary },
    { data: events },
    { data: connections },
    { data: membership },
    { data: calendarSync },
    { data: prefs },
    { data: weekEvents },
    { data: latestCheckin },
    { data: foodRows },
    { data: latestReview },
    { data: habitRows },
    { data: habitLogRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
    supabase
      .from("health_metrics")
      .select(
        "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, activity_balance, body_temperature_delta"
      )
      .eq("user_id", userId)
      .gte("date", twoWeeksAgo)
      .order("date", { ascending: true })
      .returns<HealthMetric[]>(),
    supabase
      .from("daily_summaries")
      .select("date, summary, focus, insights, recommendations, generated_at")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle<DailySummary>(),
    supabase
      .from("schedule_events")
      .select("*")
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true })
      .returns<ScheduleEvent[]>(),
    supabase.rpc("my_connections"),
    supabase
      .from("household_members")
      .select("household_id, role, households(name, invite_code)")
      .eq("user_id", userId)
      .maybeSingle<{
        household_id: string;
        role: "owner" | "member";
        households: { name: string; invite_code: string } | null;
      }>(),
    supabase
      .from("calendar_sync_settings")
      .select("sync_enabled, google_calendar_id, last_synced_at, daybreak_calendar_id")
      .eq("user_id", userId)
      .maybeSingle<CalendarSyncSettings>(),
    supabase
      .from("user_preferences")
      .select("onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle<{ onboarding_completed: boolean }>(),
    supabase
      .from("schedule_events")
      .select("starts_at, ends_at, completed_at")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .returns<{ starts_at: string; ends_at: string; completed_at: string | null }[]>(),
    supabase
      .from("subjective_checkins")
      .select("date, mood, energy, stress, soreness, note")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle<SubjectiveCheckin>(),
    supabase
      .from("food_logs")
      .select("date, calories, protein_g")
      .eq("user_id", userId)
      .gte("date", isoDate(new Date(Date.now() - 86_400_000)))
      .returns<{ date: string; calories: number | null; protein_g: number | null }[]>(),
    supabase
      .from("evening_reviews")
      .select("date, day_rating, went_well, to_improve, tomorrow_intention")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle<EveningReview>(),
    supabase
      .from("habits")
      .select("id, name, emoji, color, sort_order")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .returns<Habit[]>(),
    supabase
      .from("habit_logs")
      .select("habit_id, date")
      .eq("user_id", userId)
      .gte("date", isoDate(new Date(Date.now() - 60 * 86_400_000)))
      .returns<{ habit_id: string; date: string }[]>(),
  ]);

  // Household: resolve member display names (admin client, scoped to the
  // household this user verifiably belongs to).
  let household: HouseholdInfo | null = null;
  if (membership?.households) {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", membership.household_id)
      .returns<{ user_id: string }[]>();

    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: memberProfiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", memberIds)
      .returns<{ id: string; display_name: string }[]>();

    const nameById = new Map((memberProfiles ?? []).map((p) => [p.id, p.display_name]));

    household = {
      id: membership.household_id,
      name: membership.households.name,
      invite_code: membership.households.invite_code,
      role: membership.role,
      members: memberIds.map((id) => ({
        user_id: id,
        display_name: nameById.get(id) || "Member",
      })),
    };
  }

  const weather =
    profile?.latitude != null && profile?.longitude != null
      ? await fetchWeather(profile.latitude, profile.longitude)
      : null;

  const allEvents = events ?? [];
  const todayEvents = allEvents.filter((e) => e.user_id === userId);
  const householdEvents = allEvents.filter((e) => e.user_id !== userId);

  const todayMetric = (metrics ?? []).find((m) => m.date === todayStr) ?? null;

  // Adherence over the last 7 days, plus a current daily streak.
  const tz = profile?.timezone || "UTC";
  const localDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const week = weekEvents ?? [];
  const pastEvents = week.filter((e) => new Date(e.ends_at).getTime() <= Date.now());
  const doneCount = pastEvents.filter((e) => e.completed_at != null).length;
  const completedDays = new Set(
    week.filter((e) => e.completed_at != null).map((e) => localDay(new Date(e.starts_at)))
  );
  let streak = 0;
  for (let i = 0; i <= 14; i++) {
    if (completedDays.has(localDay(new Date(Date.now() - i * 86_400_000)))) streak++;
    else break;
  }
  const adherence = { total: pastEvents.length, done: doneCount, streak };

  // Treat the latest check-in as "today's" only if it lands on the local day.
  const localToday = localDay(new Date());
  const todayCheckin = latestCheckin && latestCheckin.date === localToday ? latestCheckin : null;

  // Habits: bucket completion dates per habit, then compute streak/today/week.
  const logsByHabit = new Map<string, string[]>();
  for (const log of habitLogRows ?? []) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log.date);
    logsByHabit.set(log.habit_id, list);
  }
  const habits = (habitRows ?? []).map((h) =>
    computeHabitStatus(h, logsByHabit.get(h.id) ?? [], localToday)
  );

  const todaysFood = (foodRows ?? []).filter((f) => f.date === localToday);
  const todayNutrition = todaysFood.length
    ? {
        calories: todaysFood.reduce((s, f) => s + (f.calories ?? 0), 0),
        protein: todaysFood.reduce((s, f) => s + (f.protein_g ?? 0), 0),
        count: todaysFood.length,
      }
    : null;

  return {
    profile: profile ?? null,
    metrics: metrics ?? [],
    today: todayMetric ?? (metrics ?? []).at(-1) ?? null,
    summary: summary ?? null,
    todayEvents,
    householdEvents,
    household,
    connections: (connections as Connection[] | null) ?? [],
    weather,
    calendarSync: calendarSync ?? null,
    onboardingCompleted: prefs?.onboarding_completed ?? false,
    adherence,
    todayCheckin: todayCheckin ?? null,
    todayNutrition,
    todayReview: latestReview && latestReview.date === localToday ? latestReview : null,
    habits,
  };
}
