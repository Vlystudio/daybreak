import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAccountDeletionJob, queueAccountDeletion } from "@/lib/account-deletion";
import { verifyAdminAuth } from "@/lib/security/admin-auth";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const requestSchema = z.object({
  userId: z.uuid(),
  write: z.literal(true).optional(),
});

/**
 * Explicit support workflow for credible actual knowledge of a minor. A bare
 * request is a dry run; `write: true` is required to restrict and queue deletion.
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request, "admin.restrict_minor");
  if (!auth.ok) return auth.response;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(
    parsed.data.userId
  );
  if (userError || !userData.user)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (parsed.data.write !== true) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      action: "restrict_and_queue_known_minor_deletion",
    });
  }

  try {
    const { jobId } = await queueAccountDeletion(admin, parsed.data.userId, "known_minor");
    const result = await processAccountDeletionJob(admin, jobId);
    await audit(null, "admin.minor_account_restricted", {
      metadata: { deletionOutcome: result },
    });
    return NextResponse.json({ ok: true, dryRun: false, deletion: result });
  } catch (reason) {
    safeLog("error", "admin.minor_restriction_failed", { errorClass: errorClass(reason) });
    return NextResponse.json({ error: "Restriction or deletion queue failed" }, { status: 500 });
  }
}
