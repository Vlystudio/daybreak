import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOuraForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import { refreshTodayPlanForUser } from "@/lib/planner";
import { audit } from "@/lib/audit";
import { serverEnv } from "@/env";

export const maxDuration = 300;

/**
 * Daily morning job (Vercel Cron): pull fresh Oura data, refresh calendars,
 * and generate the AI briefing for every connected user. Vercel sends
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
      if (providers.has("oura")) await syncOuraForUser(userId, 7);
      if (providers.has("google")) await syncCalendarForUser(userId);
      // Rebuild today's plan from the freshly-synced recovery + weather.
      try {
        await refreshTodayPlanForUser(userId);
      } catch (err) {
        console.error("[cron] plan refresh failed for a user:", err);
      }
      await generateSummaryForUser(userId);
      synced++;
    } catch (err) {
      failed++;
      console.error(`[cron] morning sync failed for a user:`, err);
    }
  }

  await audit(null, "cron.morning_sync", { metadata: { users: byUser.size, synced, failed } });
  return NextResponse.json({ users: byUser.size, synced, failed });
}
