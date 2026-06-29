"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { securityRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

/**
 * Self-service data rights (GDPR/CCPA): a user can export everything Daybreak
 * holds about them, and permanently delete their account. Both derive the user
 * id server-side from the session — never from client input.
 */

// The user's own data, with the column that scopes each table to them. Read
// through the RLS client, so this can only ever return the caller's own rows.
const EXPORT_TABLES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "user_preferences", column: "user_id" },
  { table: "health_metrics", column: "user_id" },
  { table: "schedule_events", column: "user_id" },
  { table: "daily_summaries", column: "user_id" },
  { table: "subjective_checkins", column: "user_id" },
  { table: "evening_reviews", column: "user_id" },
  { table: "food_logs", column: "user_id" },
  { table: "water_logs", column: "user_id" },
  { table: "fitness_plans", column: "user_id" },
  { table: "user_workouts", column: "user_id" },
  { table: "habits", column: "user_id" },
  { table: "goals", column: "user_id" },
  { table: "reminders", column: "user_id" },
  { table: "notification_settings", column: "user_id" },
  { table: "meal_plans", column: "user_id" },
  { table: "user_birds", column: "user_id" },
  { table: "user_game", column: "user_id" },
  // Health provenance + imported wearable data (the user's own, no secrets).
  { table: "health_observations", column: "user_id" },
  { table: "health_daily_samples", column: "user_id" },
  { table: "health_workouts", column: "user_id" },
  { table: "apple_health_imports", column: "user_id" },
];

export interface DataExport {
  exportedAt: string;
  userId: string;
  email: string | null;
  data: Record<string, unknown[]>;
}

export async function exportMyData(): Promise<
  { ok: true; export: DataExport } | { ok: false; error: string }
> {
  const user = await requireUser();

  const limited = await securityRateLimit(`data-export:${user.id}`, RATE_LIMITS.dataExport);
  if (!limited.ok)
    return { ok: false, error: "You've exported recently — please wait a bit and try again." };

  const supabase = await createClient();

  const data: Record<string, unknown[]> = {};
  await Promise.all(
    EXPORT_TABLES.map(async ({ table, column }) => {
      // A table that doesn't exist / changed shape is skipped rather than failing
      // the whole export.
      const { data: rows, error } = await supabase.from(table).select("*").eq(column, user.id);
      if (!error && rows) data[table] = rows;
    })
  );

  await audit(user.id, "data.exported");
  return {
    ok: true,
    export: {
      exportedAt: new Date().toISOString(),
      userId: user.id,
      email: user.email ?? null,
      data,
    },
  };
}

export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const limited = await securityRateLimit(`account-delete:${user.id}`, RATE_LIMITS.accountDelete);
  if (!limited.ok)
    return { ok: false, error: "Too many attempts — please wait a moment and try again." };

  const admin = createAdminClient();

  // Every user-owned table cascades from auth.users (ON DELETE CASCADE), so
  // removing the auth user erases every trace. Requires the service role.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Couldn't delete your account — please try again." };

  // Logged with a null actor + the id in metadata, so the audit row survives the
  // cascade that just removed everything keyed to this user.
  await audit(null, "account.deleted", { metadata: { user: user.id } });

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Session is already invalid post-deletion; clearing cookies is best-effort.
  }
  redirect("/");
}
