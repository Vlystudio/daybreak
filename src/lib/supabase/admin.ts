import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/env";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Use only for operations the user must not be able to do directly:
 * storing/reading encrypted OAuth tokens, cron ingestion, audit logs,
 * rate-limit counters. Every call site MUST scope queries by a server-derived
 * user id (never one supplied by the client).
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
