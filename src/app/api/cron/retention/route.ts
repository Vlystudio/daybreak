import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

/**
 * Production-safe by default: an authenticated request without `write=1` only
 * reports matches. Vercel Cron uses the explicit write path in vercel.json.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request, "cron.retention");
  if (!auth.ok) return auth.response;
  const dryRun = request.nextUrl.searchParams.get("write") !== "1";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("run_retention_maintenance", {
      p_dry_run: dryRun,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, dryRun, categories: data ?? [] });
  } catch (reason) {
    safeLog("error", "retention.run_failed", { errorClass: errorClass(reason) });
    return NextResponse.json({ error: "Retention maintenance failed" }, { status: 500 });
  }
}
