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
  | "notification.morning_email_sent"
  | "notification.unsubscribed"
  | "checkin.logged"
  | "food.analyzed"
  | "food.logged"
  | "body.logged"
  | "review.logged"
  | "habit.created"
  | "health.analyzed"
  | "household.created"
  | "household.joined"
  | "household.left"
  | "profile.updated"
  | "preferences.updated"
  | "plan.generated"
  | "fitness_plan.generated"
  | "exercises.generated"
  | "workout.generated"
  | "workout.logged"
  | "grocery.settings_updated"
  | "pantry.updated"
  | "price.added"
  | "shopping_list.created"
  | "shopping_list.updated"
  | "meal_plan.generated"
  | "friend.requested"
  | "friend.accepted"
  | "competition.created"
  | "competition.joined"
  | "cron.morning_sync"
  | "cron.calendar_sync"
  | "cron.data_sync";

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
