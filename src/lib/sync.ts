import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOuraDailyMetrics } from "@/lib/integrations/oura";
import { fetchGoogleEvents } from "@/lib/integrations/google-calendar";
import { fetchWeather } from "@/lib/integrations/weather";
import { generateMorningBriefing, type MetricsForPrompt } from "@/lib/integrations/ai";
import { audit } from "@/lib/audit";

/**
 * Sync orchestration. All functions take a server-derived userId and are
 * called from cron handlers or authenticated server actions only.
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pull the last `days` days of Oura data into health_metrics. */
export async function syncOuraForUser(userId: string, days = 7): Promise<boolean> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  const metrics = await fetchOuraDailyMetrics(userId, isoDate(start), isoDate(end));
  if (!metrics) return false;

  if (metrics.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("health_metrics")
      .upsert(
        metrics.map((m) => ({ user_id: userId, ...m })),
        { onConflict: "user_id,date" }
      );
    if (error) throw new Error(`Failed to store health metrics: ${error.message}`);
  }
  return true;
}

/** Mirror the next 7 days of Google Calendar events into schedule_events. */
export async function syncCalendarForUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("calendar_sync_settings")
    .select("sync_enabled, google_calendar_id")
    .eq("user_id", userId)
    .maybeSingle<{ sync_enabled: boolean; google_calendar_id: string }>();

  if (settings && !settings.sync_enabled) return false;
  const calendarId = settings?.google_calendar_id ?? "primary";

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 7 * 86_400_000);

  const events = await fetchGoogleEvents(userId, calendarId, windowStart, windowEnd);
  if (events === null) return false;

  const rows = events
    .map((e) => {
      const allDay = Boolean(e.start.date);
      const startsAt = e.start.dateTime ?? (e.start.date ? `${e.start.date}T00:00:00Z` : null);
      const endsAt = e.end.dateTime ?? (e.end.date ? `${e.end.date}T00:00:00Z` : null);
      if (!startsAt || !endsAt) return null;
      return {
        user_id: userId,
        title: (e.summary ?? "Busy").slice(0, 200),
        description: e.description?.slice(0, 2000) ?? null,
        location: e.location?.slice(0, 300) ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay,
        source: "google" as const,
        google_event_id: e.id,
        color: "sky" as const,
      };
    })
    .filter((r) => r !== null);

  // Replace the synced window: remove google events no longer present, upsert the rest.
  const keepIds = rows.map((r) => r.google_event_id);
  let deleteQuery = admin
    .from("schedule_events")
    .delete()
    .eq("user_id", userId)
    .eq("source", "google")
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString());
  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not("google_event_id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(`Calendar sync cleanup failed: ${deleteError.message}`);

  if (rows.length > 0) {
    const { error } = await admin
      .from("schedule_events")
      .upsert(rows, { onConflict: "user_id,google_event_id" });
    if (error) throw new Error(`Calendar sync upsert failed: ${error.message}`);
  }

  await admin
    .from("calendar_sync_settings")
    .upsert(
      { user_id: userId, last_synced_at: new Date().toISOString(), google_calendar_id: calendarId },
      { onConflict: "user_id" }
    );

  await audit(userId, "calendar.synced", { metadata: { events: rows.length } });
  return true;
}

/** Generate (or regenerate) today's AI briefing for a user. */
export async function generateSummaryForUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const today = isoDate(new Date());
  const weekAgo = isoDate(new Date(Date.now() - 7 * 86_400_000));

  const [{ data: profile }, { data: metrics }, { data: events }] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name, latitude, longitude")
      .eq("id", userId)
      .maybeSingle<{ display_name: string; latitude: number | null; longitude: number | null }>(),
    admin
      .from("health_metrics")
      .select(
        "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency"
      )
      .eq("user_id", userId)
      .gte("date", weekAgo)
      .order("date", { ascending: true })
      .returns<MetricsForPrompt[]>(),
    admin
      .from("schedule_events")
      .select("title, starts_at, ends_at, all_day")
      .eq("user_id", userId)
      .gte("starts_at", `${today}T00:00:00Z`)
      .lt("starts_at", `${today}T23:59:59Z`)
      .order("starts_at", { ascending: true })
      .returns<{ title: string; starts_at: string; ends_at: string; all_day: boolean }[]>(),
  ]);

  const weather =
    profile?.latitude != null && profile?.longitude != null
      ? await fetchWeather(profile.latitude, profile.longitude)
      : null;

  const todayMetrics = metrics?.find((m) => m.date === today) ?? metrics?.at(-1) ?? null;

  const briefing = await generateMorningBriefing({
    displayName: profile?.display_name ?? "",
    todayMetrics,
    recentMetrics: metrics ?? [],
    weather,
    todayEvents: (events ?? []).map((e) => ({
      title: e.title,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      allDay: e.all_day,
    })),
  });

  if (!briefing) return false;

  const { error } = await admin.from("daily_summaries").upsert(
    {
      user_id: userId,
      date: today,
      summary: briefing.summary,
      focus: briefing.focus,
      insights: briefing.insights,
      recommendations: briefing.recommendations,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );
  if (error) throw new Error(`Failed to store daily summary: ${error.message}`);

  await audit(userId, "summary.generated");
  return true;
}
