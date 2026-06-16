import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCalendarForUser } from "@/lib/sync";
import { audit } from "@/lib/audit";
import { serverEnv } from "@/env";

export const maxDuration = 300;

/** Hourly job: keep Google Calendar mirrors fresh for all connected users. */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connections, error } = await admin
    .from("oauth_connections")
    .select("user_id")
    .eq("provider", "google")
    .returns<{ user_id: string }[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  let synced = 0;
  let failed = 0;

  for (const { user_id } of connections ?? []) {
    try {
      await syncCalendarForUser(user_id);
      synced++;
    } catch (err) {
      failed++;
      console.error("[cron] calendar sync failed for a user:", err);
    }
  }

  await audit(null, "cron.calendar_sync", { metadata: { synced, failed } });
  return NextResponse.json({ synced, failed });
}
