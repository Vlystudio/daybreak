import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOuraForUser, syncFitbitForUser, syncCalendarForUser } from "@/lib/sync";
import { maybeRefreshTodayPlanForUser, maybeAutoPlanForUser } from "@/lib/planner";
import { dispatchReminders } from "@/lib/reminders";
import { mapWithConcurrency } from "@/lib/concurrency";
import { audit } from "@/lib/audit";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

export const maxDuration = 300;

// Kept modest because each user's plan refresh can itself fan out a handful of
// model calls — this bounds the total OpenAI calls in flight at any moment.
const USER_CONCURRENCY = 5;

/**
 * Periodic job (hourly): keep Oura health data and Google Calendar mirrors
 * fresh for all connected users throughout the day. The full morning job
 * (`/api/cron/morning-sync`) still runs once daily and additionally generates
 * the AI briefing — we don't regenerate that hourly. Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request, "cron.data_sync");
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: connections, error } = await admin
    .from("oauth_connections")
    .select("user_id, provider")
    .returns<{ user_id: string; provider: "oura" | "google" | "fitbit" }[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  const byUser = new Map<string, Set<string>>();
  for (const c of connections ?? []) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, new Set());
    byUser.get(c.user_id)!.add(c.provider);
  }

  const syncResults = await mapWithConcurrency(
    [...byUser],
    USER_CONCURRENCY,
    async ([userId, providers]) => {
      // Pull the last 2 days for intraday refresh (the morning job backfills 7).
      if (providers.has("oura")) await syncOuraForUser(userId, 2);
      if (providers.has("fitbit")) await syncFitbitForUser(userId, 2);
      if (providers.has("google")) await syncCalendarForUser(userId);
      // Rebuild today's plan once that day's recovery is in (gated internally).
      try {
        await maybeRefreshTodayPlanForUser(userId);
      } catch (err) {
        safeLog("error", "cron.plan_refresh_user_failed", { errorClass: errorClass(err) });
      }
    }
  );

  let synced = 0;
  let failed = 0;
  for (const r of syncResults) {
    if (r.status === "fulfilled") synced++;
    else {
      failed++;
      safeLog("error", "cron.data_sync_user_failed", { errorClass: errorClass(r.reason) });
    }
  }

  // Auto-plan pass: regenerate the whole scope for users who opted into a
  // cadence, independent of integrations. Each call is gated to run at most once
  // per local day, so checking hourly just catches each user's local morning.
  let autoPlanned = 0;
  const { data: cadenceUsers } = await admin
    .from("user_preferences")
    .select("user_id")
    .eq("onboarding_completed", true)
    .neq("auto_plan_cadence", "off")
    .not("auto_plan_cadence", "is", null)
    .returns<{ user_id: string }[]>();

  const autoPlanResults = await mapWithConcurrency(
    cadenceUsers ?? [],
    USER_CONCURRENCY,
    ({ user_id }) => maybeAutoPlanForUser(user_id)
  );
  for (const r of autoPlanResults) {
    if (r.status === "fulfilled") {
      if (r.value !== null) autoPlanned++;
    } else {
      safeLog("error", "cron.auto_plan_user_failed", { errorClass: errorClass(r.reason) });
    }
  }

  // Fire any contextual reminders due this hour (local-time matched).
  let reminders = 0;
  try {
    reminders = await dispatchReminders();
  } catch (err) {
    safeLog("error", "cron.reminder_dispatch_failed", { errorClass: errorClass(err) });
  }

  await audit(null, "cron.data_sync", {
    metadata: { users: byUser.size, synced, failed, autoPlanned, reminders },
  });
  return NextResponse.json({ users: byUser.size, synced, failed, autoPlanned, reminders });
}
