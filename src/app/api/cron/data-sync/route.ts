import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOuraForUser, syncCalendarForUser } from "@/lib/sync";
import { maybeRefreshTodayPlanForUser } from "@/lib/planner";
import { audit } from "@/lib/audit";
import { serverEnv } from "@/env";

export const maxDuration = 300;

/**
 * Periodic job (hourly): keep Oura health data and Google Calendar mirrors
 * fresh for all connected users throughout the day. The full morning job
 * (`/api/cron/morning-sync`) still runs once daily and additionally generates
 * the AI briefing — we don't regenerate that hourly. Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connections, error } = await admin
    .from("oauth_connections")
    .select("user_id, provider")
    .returns<{ user_id: string; provider: "oura" | "google" }[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  const byUser = new Map<string, Set<string>>();
  for (const c of connections ?? []) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, new Set());
    byUser.get(c.user_id)!.add(c.provider);
  }

  let synced = 0;
  let failed = 0;

  for (const [userId, providers] of byUser) {
    try {
      // Pull the last 2 days for intraday refresh (the morning job backfills 7).
      if (providers.has("oura")) await syncOuraForUser(userId, 2);
      if (providers.has("google")) await syncCalendarForUser(userId);
      // Rebuild today's plan once that day's recovery is in (gated internally).
      try {
        await maybeRefreshTodayPlanForUser(userId);
      } catch (err) {
        console.error("[cron] plan refresh failed for a user:", err);
      }
      synced++;
    } catch (err) {
      failed++;
      console.error("[cron] data sync failed for a user:", err);
    }
  }

  await audit(null, "cron.data_sync", { metadata: { users: byUser.size, synced, failed } });
  return NextResponse.json({ users: byUser.size, synced, failed });
}
