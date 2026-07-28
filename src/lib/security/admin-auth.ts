import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { matchAdminSecret } from "@/lib/security/admin-auth-core";
import { safeLog } from "@/lib/security/safe-logger";

export type AdminAuthResult = { ok: true } | { ok: false; response: NextResponse };

/** High-impact admin actions use a dedicated credential, never CRON_SECRET. */
export function verifyAdminAuth(request: NextRequest, action: string): AdminAuthResult {
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = serverEnv().ADMIN_ACTION_SECRET;
  if (!matchAdminSecret(presented, secret)) {
    safeLog("warn", "security.admin_auth_denied", {
      action,
      hasHeader: header.length > 0,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}
