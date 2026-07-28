import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueAccountDeletionJobs } from "@/lib/account-deletion";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import { safeLog } from "@/lib/security/safe-logger";

export const maxDuration = 300;

/** Durable retry worker. The response contains counts only, never user ids. */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request, "cron.account_deletion");
  if (!auth.ok) return auth.response;

  try {
    const result = await processDueAccountDeletionJobs(createAdminClient(), 10);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    safeLog("error", "account_deletion.worker_batch_failed");
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}
