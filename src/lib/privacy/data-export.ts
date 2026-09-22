export interface ExportTableDefinition {
  table: string;
  ownerColumn: "id" | "user_id";
  select?: string;
}

/**
 * Directly user-owned tables that make up the portable export. Tables without
 * a direct user key are intentionally omitted to avoid leaking household or
 * catalog records belonging to other people.
 */
export const PORTABLE_EXPORT_TABLES: readonly ExportTableDefinition[] = [
  { table: "profiles", ownerColumn: "id" },
  {
    table: "account_eligibility",
    ownerColumn: "user_id",
    select:
      "status, adult_attested, adult_attested_at, adult_attestation_version, terms_version, privacy_version, created_at, updated_at",
  },
  { table: "user_legal_acceptances", ownerColumn: "user_id" },
  { table: "ai_consent_history", ownerColumn: "user_id" },
  {
    table: "privacy_rights_requests",
    ownerColumn: "user_id",
    select:
      "id, request_type, scope, jurisdiction_code, status, requested_at, deadline_at, appeal_of, outcome_code, resolved_at, updated_at",
  },
  { table: "user_preferences", ownerColumn: "user_id" },
  { table: "health_metrics", ownerColumn: "user_id" },
  { table: "health_observations", ownerColumn: "user_id" },
  { table: "health_daily_samples", ownerColumn: "user_id" },
  { table: "health_workouts", ownerColumn: "user_id" },
  { table: "apple_health_imports", ownerColumn: "user_id" },
  { table: "subjective_checkins", ownerColumn: "user_id" },
  { table: "health_checkins", ownerColumn: "user_id" },
  { table: "body_measurements", ownerColumn: "user_id" },
  { table: "schedule_events", ownerColumn: "user_id" },
  { table: "calendar_sync_settings", ownerColumn: "user_id" },
  { table: "daily_summaries", ownerColumn: "user_id" },
  { table: "evening_reviews", ownerColumn: "user_id" },
  { table: "food_logs", ownerColumn: "user_id" },
  { table: "water_logs", ownerColumn: "user_id" },
  { table: "fitness_plans", ownerColumn: "user_id" },
  { table: "user_equipment", ownerColumn: "user_id" },
  { table: "user_limitations", ownerColumn: "user_id" },
  { table: "user_workouts", ownerColumn: "user_id" },
  { table: "user_workout_logs", ownerColumn: "user_id" },
  { table: "habits", ownerColumn: "user_id" },
  { table: "habit_logs", ownerColumn: "user_id" },
  { table: "goals", ownerColumn: "user_id" },
  { table: "reminders", ownerColumn: "user_id" },
  { table: "nudges", ownerColumn: "user_id" },
  {
    table: "notification_settings",
    ownerColumn: "user_id",
    select: "morning_email_enabled, last_morning_email_sent_at, updated_at",
  },
  { table: "meal_plans", ownerColumn: "user_id" },
  { table: "grocery_settings", ownerColumn: "user_id" },
  { table: "nutrition_goals", ownerColumn: "user_id" },
  { table: "grocery_purchases", ownerColumn: "user_id" },
  { table: "recipe_feedback", ownerColumn: "user_id" },
  { table: "user_stores", ownerColumn: "user_id" },
  { table: "analytics_events", ownerColumn: "user_id" },
  { table: "user_birds", ownerColumn: "user_id" },
  { table: "user_game", ownerColumn: "user_id" },
  { table: "reward_ledger", ownerColumn: "user_id" },
  { table: "user_inventory", ownerColumn: "user_id" },
  { table: "user_eggs", ownerColumn: "user_id" },
] as const;

const NON_EXPORTABLE_KEY =
  /(?:^|_)(?:access_token|refresh_token|token_enc|unsubscribe_token|push_endpoint|authorization|cookie|password|secret|api_key|permit|nonce_hash|status_token_hash|subject_hash|processor_propagation_state|internal_rule)(?:_|$)/i;

export function sanitizePortableExport(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[depth limit]";
  if (Array.isArray(value)) return value.map((item) => sanitizePortableExport(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !NON_EXPORTABLE_KEY.test(key))
      .map(([key, child]) => [key, sanitizePortableExport(child, depth + 1)])
  );
}
