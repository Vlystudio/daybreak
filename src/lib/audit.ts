import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append-only audit log. Never include health values or tokens in metadata —
 * record what happened, not the sensitive payload.
 */
export type AuditAction =
  | "auth.login"
  | "connection.linked"
  | "connection.unlinked"
  | "schedule.created"
  | "schedule.updated"
  | "schedule.deleted"
  | "calendar.synced"
  | "summary.generated"
  | "household.created"
  | "household.joined"
  | "household.left"
  | "profile.updated"
  | "cron.morning_sync"
  | "cron.calendar_sync";

export async function audit(
  userId: string | null,
  action: AuditAction,
  details: { entity?: string; entityId?: string; metadata?: Record<string, string | number | boolean> } = {}
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      entity: details.entity ?? null,
      entity_id: details.entityId ?? null,
      metadata: details.metadata ?? {},
    });
  } catch (err) {
    // Auditing must never break the user-facing operation.
    console.error("[audit] failed to record", action, err);
  }
}
