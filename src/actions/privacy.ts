"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { securityRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import {
  AccountDeletionError,
  processAccountDeletionJob,
  queueAccountDeletion,
} from "@/lib/account-deletion";
import { safeLog } from "@/lib/security/safe-logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PORTABLE_EXPORT_TABLES, sanitizePortableExport } from "@/lib/privacy/data-export";

/**
 * Self-service data rights (GDPR/CCPA): a user can export everything Daybreak
 * holds about them, and permanently delete their account. Both derive the user
 * id server-side from the session — never from client input.
 */

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
    PORTABLE_EXPORT_TABLES.map(async ({ table, ownerColumn, select }) => {
      // A table that doesn't exist / changed shape is skipped rather than failing
      // the whole export.
      const { data: rows, error } = await supabase
        .from(table)
        .select(select ?? "*")
        .eq(ownerColumn, user.id);
      if (!error && rows) data[table] = sanitizePortableExport(rows) as unknown[];
    })
  );

  // Connection metadata is part of the user's export, but encrypted tokens and
  // provider identifiers never cross this boundary.
  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("oauth_connections")
    .select("provider, scope, expires_at, created_at, updated_at")
    .eq("user_id", user.id);
  if (connections) data.connected_integrations = connections;

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

const privacyRequestSchema = z.object({
  requestType: z.enum([
    "confirmation",
    "access",
    "correction",
    "deletion",
    "withdraw_consent",
    "cease_collection",
    "cease_sharing",
    "third_party_list",
    "appeal",
  ]),
  scope: z.enum(["consumer_health", "all_personal_data"]),
  jurisdictionCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/)
    .optional()
    .or(z.literal("")),
  appealOf: z.uuid().optional(),
});

export interface PrivacyRightsRequestSummary {
  id: string;
  request_type: string;
  scope: string;
  status: string;
  requested_at: string;
  deadline_at: string;
  appeal_of: string | null;
  outcome_code: string | null;
}

export async function listMyPrivacyRightsRequests(): Promise<PrivacyRightsRequestSummary[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_rights_requests")
    .select("id, request_type, scope, status, requested_at, deadline_at, appeal_of, outcome_code")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(25);
  if (error) return [];
  return (data ?? []) as PrivacyRightsRequestSummary[];
}

export async function createPrivacyRightsRequest(
  input: unknown
): Promise<{ ok: true; request: PrivacyRightsRequestSummary } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = privacyRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid privacy request." };
  const limited = await securityRateLimit(`privacy-rights:${user.id}`, RATE_LIMITS.dataExport);
  if (!limited.ok) return { ok: false, error: "Please wait before submitting another request." };

  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc(
    "create_current_user_privacy_rights_request",
    {
      p_request_type: parsed.data.requestType,
      p_scope: parsed.data.scope,
      p_jurisdiction_code: parsed.data.jurisdictionCode || null,
      p_deadline_days: 30,
      p_appeal_of: parsed.data.appealOf ?? null,
    }
  );
  if (error || typeof requestId !== "string") {
    safeLog("error", "privacy_rights.submit_failed", {
      errorClass: error?.code ?? "database_error",
    });
    return { ok: false, error: "The request could not be submitted. Please try again." };
  }
  const { data: request } = await supabase
    .from("privacy_rights_requests")
    .select("id, request_type, scope, status, requested_at, deadline_at, appeal_of, outcome_code")
    .eq("id", requestId)
    .single();
  if (!request) return { ok: false, error: "The request was submitted but status is unavailable." };
  await audit(user.id, "privacy_rights.submitted", {
    metadata: { requestType: parsed.data.requestType, scope: parsed.data.scope },
  });
  revalidatePath("/settings");
  return { ok: true, request: request as PrivacyRightsRequestSummary };
}

export async function deleteMyAccount(input: {
  confirmation: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  if (input?.confirmation !== "DELETE") {
    return { ok: false, error: "Type DELETE to confirm permanent account deletion." };
  }
  if (!input.password || input.password.length > 200) {
    return { ok: false, error: "Enter your current password to confirm this request." };
  }
  if (!user.email) {
    return {
      ok: false,
      error: "This account cannot be reauthenticated with a password. Contact privacy support.",
    };
  }

  const limited = await securityRateLimit(`account-delete:${user.id}`, RATE_LIMITS.accountDelete);
  if (!limited.ok)
    return { ok: false, error: "Too many attempts — please wait a moment and try again." };

  // A destructive account-lifecycle operation requires recent credential
  // verification; an old or stolen session cookie is not sufficient.
  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.password,
  });
  if (reauthError) {
    return { ok: false, error: "The current password was not accepted." };
  }

  const admin = createAdminClient();
  let jobId: string;
  let statusToken: string;
  try {
    ({ jobId, statusToken } = await queueAccountDeletion(admin, user.id));
  } catch (error) {
    const step = error instanceof AccountDeletionError ? error.step : "queue";
    safeLog("error", "account_deletion.queue_failed", { step });
    return {
      ok: false,
      error: "Account deletion could not be queued. Please retry or contact privacy support.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("daybreak_deletion_status", statusToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/account-deletion/status",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });

  // Revoke every current refresh token immediately. If Supabase is briefly
  // unavailable, deletion_pending still denies app/RLS access and the final
  // Auth deletion invalidates all sessions on a retry.
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    safeLog("error", "account_deletion.session_revocation_unconfirmed");
  }

  // Give the user a fast path while the same durable job remains eligible for
  // the cron worker if a provider or storage dependency is unavailable.
  try {
    await processAccountDeletionJob(admin, jobId);
  } catch (error) {
    const step = error instanceof AccountDeletionError ? error.step : "worker";
    safeLog("warn", "account_deletion.worker_deferred", { step });
  }
  redirect("/account-deletion/status");
}
