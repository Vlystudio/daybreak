import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOuraDailyMetrics } from "@/lib/integrations/oura";
import {
  fetchGoogleEvents,
  createDaybreakCalendar,
  insertGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  listDaybreakCalendarEvents,
  scopeAllowsWrite,
  type GoogleEventInput,
} from "@/lib/integrations/google-calendar";
import { getValidAccessToken } from "@/lib/integrations/tokens";
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

  try {
    await exportPlanToGoogle(userId);
  } catch (err) {
    console.error("[sync] export to Google failed:", err);
  }
  return true;
}

interface PlanEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  google_export_id: string | null;
  google_exported_at: string | null;
  updated_at: string;
}

function toGoogleInput(e: PlanEventRow): GoogleEventInput {
  const base = {
    summary: e.title,
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    daybreakId: e.id,
  };
  if (e.all_day) {
    const startDate = e.starts_at.slice(0, 10);
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return { ...base, start: { date: startDate }, end: { date: d.toISOString().slice(0, 10) } };
  }
  return { ...base, start: { dateTime: e.starts_at }, end: { dateTime: e.ends_at } };
}

/**
 * Mirror Daybreak's own plan/manual events (next 30 days) into a dedicated
 * "Daybreak" Google calendar: insert new ones, update changed ones, and delete
 * Google copies whose Daybreak event is gone. No-ops if the connection is
 * read-only (user needs to reconnect for write access).
 */
export async function exportPlanToGoogle(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const accessToken = await getValidAccessToken(userId, "google");
  if (!accessToken) return false;

  const { data: conn } = await admin
    .from("oauth_connections")
    .select("scope")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle<{ scope: string | null }>();
  if (!scopeAllowsWrite(conn?.scope)) return false; // read-only connection

  const { data: settings } = await admin
    .from("calendar_sync_settings")
    .select("sync_enabled, daybreak_calendar_id")
    .eq("user_id", userId)
    .maybeSingle<{ sync_enabled: boolean; daybreak_calendar_id: string | null }>();
  if (settings && settings.sync_enabled === false) return false;

  let calendarId = settings?.daybreak_calendar_id ?? null;
  if (!calendarId) {
    calendarId = await createDaybreakCalendar(accessToken);
    if (!calendarId) return false;
    await admin
      .from("calendar_sync_settings")
      .upsert({ user_id: userId, daybreak_calendar_id: calendarId }, { onConflict: "user_id" });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 86_400_000);

  const { data: events } = await admin
    .from("schedule_events")
    .select("id, title, description, location, starts_at, ends_at, all_day, google_export_id, google_exported_at, updated_at")
    .eq("user_id", userId)
    .in("source", ["manual", "plan"])
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .returns<PlanEventRow[]>();

  const list = events ?? [];
  const currentIds = new Set(list.map((e) => e.id));
  const nowIso = new Date().toISOString();

  for (const e of list) {
    const body = toGoogleInput(e);
    if (!e.google_export_id) {
      const gid = await insertGoogleEvent(accessToken, calendarId, body);
      if (gid) {
        await admin
          .from("schedule_events")
          .update({ google_export_id: gid, google_exported_at: nowIso })
          .eq("id", e.id);
      }
    } else if (!e.google_exported_at || new Date(e.updated_at) > new Date(e.google_exported_at)) {
      const result = await updateGoogleEvent(accessToken, calendarId, e.google_export_id, body);
      if (result === "ok") {
        await admin.from("schedule_events").update({ google_exported_at: nowIso }).eq("id", e.id);
      } else if (result === "gone") {
        // The Google copy was deleted out from under us — re-insert next sync.
        await admin
          .from("schedule_events")
          .update({ google_export_id: null, google_exported_at: null })
          .eq("id", e.id);
      }
    }
  }

  // Remove Google copies whose Daybreak event no longer exists in the window.
  const exported = await listDaybreakCalendarEvents(accessToken, calendarId, start, end);
  for (const g of exported) {
    if (g.daybreakId && !currentIds.has(g.daybreakId)) {
      await deleteGoogleEvent(accessToken, calendarId, g.id);
    }
  }

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
