import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOuraForUser, syncFitbitForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import { sendMorningEmailForUser, sendMorningPushForUser } from "@/lib/notifications";
import { importGroceryDeals } from "@/lib/grocery/import-deals";
import { audit } from "@/lib/audit";
import { integrationsAvailable, serverEnv } from "@/env";

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
    .returns<{ user_id: string; provider: "oura" | "google" | "fitbit" }[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  // Refresh the shared grocery-deal catalog once for everyone (global, not per-user).
  if (integrationsAvailable.groceryDeals()) {
    try {
      await importGroceryDeals();
    } catch (err) {
      console.error("[cron] grocery deal import failed:", err);
    }
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
      if (providers.has("fitbit")) await syncFitbitForUser(userId, 7);
      if (providers.has("google")) await syncCalendarForUser(userId);
      const briefed = await generateSummaryForUser(userId);
      if (briefed) {
        await sendMorningEmailForUser(userId);
        await sendMorningPushForUser(userId);
      }
      synced++;
    } catch (err) {
      failed++;
      console.error(`[cron] morning sync failed for a user:`, err);
    }
  }

  await audit(null, "cron.morning_sync", { metadata: { users: byUser.size, synced, failed } });
  return NextResponse.json({ users: byUser.size, synced, failed });
}
