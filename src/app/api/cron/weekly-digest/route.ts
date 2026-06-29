import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestForUser } from "@/lib/weekly-digest";
import { mapWithConcurrency } from "@/lib/concurrency";
import { audit } from "@/lib/audit";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import { integrationsAvailable } from "@/env";

export const maxDuration = 300;

const USER_CONCURRENCY = 8;

/**
 * Weekly "week in review" digest (Vercel Cron, Sundays). Emails every user with
 * data and the morning-email preference on. No-ops if email isn't configured.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request, "cron.weekly_digest");
  if (!auth.ok) return auth.response;
  if (!integrationsAvailable.resend()) {
    return NextResponse.json({ skipped: "email not configured" });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id").returns<{ id: string }[]>();

  const results = await mapWithConcurrency(profiles ?? [], USER_CONCURRENCY, (p) =>
    sendWeeklyDigestForUser(p.id)
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value) sent++;
    } else {
      failed++;
      console.error("[cron] weekly digest failed for a user:", r.reason);
    }
  }

  await audit(null, "cron.data_sync", { metadata: { job: "weekly_digest", sent, failed } });
  return NextResponse.json({ sent, failed });
}
