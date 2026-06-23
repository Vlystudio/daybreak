import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestForUser } from "@/lib/weekly-digest";
import { audit } from "@/lib/audit";
import { integrationsAvailable, serverEnv } from "@/env";

export const maxDuration = 300;

/**
 * Weekly "week in review" digest (Vercel Cron, Sundays). Emails every user with
 * data and the morning-email preference on. No-ops if email isn't configured.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!integrationsAvailable.resend()) {
    return NextResponse.json({ skipped: "email not configured" });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id").returns<{ id: string }[]>();

  let sent = 0;
  let failed = 0;
  for (const p of profiles ?? []) {
    try {
      if (await sendWeeklyDigestForUser(p.id)) sent++;
    } catch (err) {
      failed++;
      console.error("[cron] weekly digest failed for a user:", err);
    }
  }

  await audit(null, "cron.data_sync", { metadata: { job: "weekly_digest", sent, failed } });
  return NextResponse.json({ sent, failed });
}
