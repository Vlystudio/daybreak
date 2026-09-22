import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProviderRevocationRetryableError,
  revokeProviderConnection,
  type Provider,
  type ProviderRevocationResult,
} from "@/lib/integrations/tokens";

export type AdminClient = SupabaseClient & {
  auth: SupabaseClient["auth"] & {
    admin: {
      deleteUser(userId: string): Promise<{
        error: (Error & { status?: number; code?: string }) | null;
      }>;
    };
  };
};

export type AccountDeletionReason = "user_request" | "known_minor" | "admin_required";

export interface DeletionStep {
  name: string;
  run: () => Promise<void>;
}

export class AccountDeletionError extends Error {
  constructor(public readonly step: string) {
    super(`Account deletion could not complete at step: ${step}`);
    this.name = "AccountDeletionError";
  }
}

export interface AccountDeletionStatus {
  status: "pending" | "processing" | "retry_wait" | "blocked" | "completed";
  currentStep: string;
  requestedAt: string;
  completedAt: string | null;
}

interface DeletionJobRow {
  id: string;
  user_id: string;
  reason: AccountDeletionReason;
  status_token_hash: string | null;
  status: Exclude<AccountDeletionStatus["status"], "completed">;
  current_step: string;
  attempts: number;
  requested_at: string;
  started_at: string | null;
  step_state: Record<string, string>;
  provider_revocation: Partial<
    Record<
      Provider,
      | ProviderRevocationResult
      | {
          provider: Provider;
          status: "blocked_pending_revocation";
          httpStatus: 0;
        }
    >
  >;
}

const MAX_JOB_ATTEMPTS = 8;

export function isAuthUserAlreadyDeleted(
  error: (Error & { status?: number; code?: string }) | null
): boolean {
  return error?.status === 404 || error?.code === "user_not_found";
}

export function hashDeletionStatusToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function queueAccountDeletion(
  admin: AdminClient,
  userId: string,
  reason: AccountDeletionReason = "user_request"
): Promise<{ jobId: string; statusToken: string }> {
  const statusToken = randomBytes(32).toString("base64url");
  const { data, error } = await admin.rpc("queue_account_deletion_job", {
    p_user_id: userId,
    p_reason: reason,
    p_status_token_hash: hashDeletionStatusToken(statusToken),
  });
  if (error || typeof data !== "string") {
    throw new AccountDeletionError("queue");
  }
  return { jobId: data, statusToken };
}

export async function getAccountDeletionStatus(
  admin: AdminClient,
  statusToken: string | undefined
): Promise<AccountDeletionStatus | null> {
  if (!statusToken || !/^[A-Za-z0-9_-]{40,80}$/.test(statusToken)) return null;
  const tokenHash = hashDeletionStatusToken(statusToken);

  const { data: job } = await admin
    .from("account_deletion_jobs")
    .select("status,current_step,requested_at,completed_at")
    .eq("status_token_hash", tokenHash)
    .maybeSingle();
  if (job) {
    return {
      status: job.status as AccountDeletionStatus["status"],
      currentStep: String(job.current_step),
      requestedAt: String(job.requested_at),
      completedAt: job.completed_at ? String(job.completed_at) : null,
    };
  }

  const { data: receipt } = await admin
    .from("account_deletion_receipts")
    .select("status,requested_at,completed_at")
    .eq("status_token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!receipt) return null;
  return {
    status: receipt.status as AccountDeletionStatus["status"],
    currentStep: receipt.status === "completed" ? "completed" : "finalizing",
    requestedAt: String(receipt.requested_at),
    completedAt: receipt.completed_at ? String(receipt.completed_at) : null,
  };
}

export async function runAccountDeletionSteps(steps: DeletionStep[]): Promise<void> {
  for (const step of steps) {
    try {
      await step.run();
    } catch {
      throw new AccountDeletionError(step.name);
    }
  }
}

async function removeStoragePrefix(
  admin: AdminClient,
  bucket: string,
  prefix: string
): Promise<void> {
  let offset = 0;
  const files: string[] = [];
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id) files.push(path);
      else await removeStoragePrefix(admin, bucket, path);
    }
    if (rows.length < 100) break;
    offset += rows.length;
  }
  if (files.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(files);
    if (error) throw error;
  }
}

export async function removeUserStorage(admin: AdminClient, userId: string): Promise<void> {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  for (const bucket of buckets ?? []) {
    await removeStoragePrefix(admin, bucket.name, userId);
    await removeStoragePrefix(admin, bucket.name, `users/${userId}`);
    const rootNames = ["jpg", "jpeg", "png", "webp", "zip", "json"].map(
      (extension) => `${userId}.${extension}`
    );
    const { error: removeError } = await admin.storage.from(bucket.name).remove(rootNames);
    if (removeError) throw removeError;
  }
}

async function expectNoError(promise: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await promise;
  if (error) throw error;
}

/** Idempotent local cleanup. Remote provider grants are revoked separately. */
export function buildAccountDeletionSteps(admin: AdminClient, userId: string): DeletionStep[] {
  return [
    { name: "storage", run: () => removeUserStorage(admin, userId) },
    {
      name: "local credentials and notifications",
      run: async () => {
        await Promise.all([
          expectNoError(admin.from("oauth_connections").delete().eq("user_id", userId)),
          expectNoError(admin.from("calendar_sync_settings").delete().eq("user_id", userId)),
          expectNoError(admin.from("push_subscriptions").delete().eq("user_id", userId)),
          expectNoError(admin.from("notification_settings").delete().eq("user_id", userId)),
        ]);
      },
    },
    {
      name: "social relationships",
      run: async () => {
        await Promise.all([
          expectNoError(admin.from("friendships").delete().eq("requester_id", userId)),
          expectNoError(admin.from("friendships").delete().eq("addressee_id", userId)),
          expectNoError(admin.from("nudges").delete().eq("from_user_id", userId)),
          expectNoError(admin.from("nudges").delete().eq("to_user_id", userId)),
          expectNoError(admin.from("competition_participants").delete().eq("user_id", userId)),
          expectNoError(admin.from("competitions").delete().eq("creator_id", userId)),
          expectNoError(admin.from("household_members").delete().eq("user_id", userId)),
          expectNoError(admin.from("households").delete().eq("owner_id", userId)),
        ]);
      },
    },
    {
      name: "retained-reference cleanup",
      run: async () => {
        await Promise.all([
          expectNoError(admin.from("audit_logs").delete().eq("user_id", userId)),
          expectNoError(admin.from("analytics_events").delete().eq("user_id", userId)),
          expectNoError(admin.from("rate_limits").delete().like("key", `%${userId}%`)),
          // This legacy service-only cache has no owner field. It is unused by
          // current code, so purge it rather than retain an unattributable prompt.
          expectNoError(admin.from("ai_generation_cache").delete().not("cache_key", "is", null)),
          expectNoError(admin.from("recipes").delete().eq("created_by", userId)),
          expectNoError(admin.from("product_prices").delete().eq("recorded_by", userId)),
          expectNoError(
            admin.from("products").update({ created_by: null }).eq("created_by", userId)
          ),
        ]);
      },
    },
    {
      name: "authentication account and sessions",
      run: async () => {
        // Hard deletion invalidates every active Supabase Auth session for this
        // user; it remains last so a recoverable cleanup failure cannot orphan data.
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error && !isAuthUserAlreadyDeleted(error)) throw error;
      },
    },
  ];
}

async function updateProviderRevocations(
  admin: AdminClient,
  job: DeletionJobRow
): Promise<Record<string, unknown>> {
  const outcomes: Record<string, unknown> = { ...job.provider_revocation };
  const { data, error } = await admin
    .from("oauth_connections")
    .select("provider")
    .eq("user_id", job.user_id);
  if (error) throw error;

  for (const row of data ?? []) {
    const provider = row.provider as Provider;
    if (outcomes[provider]) continue;
    try {
      outcomes[provider] = await revokeProviderConnection(job.user_id, provider);
    } catch (reason) {
      if (!(reason instanceof ProviderRevocationRetryableError)) throw reason;
      // Never delete the only local credential while a transient outage keeps
      // remote revocation unconfirmed. The job eventually becomes visibly
      // blocked for operator action, with Auth and encrypted tokens intact.
      throw reason;
    }
    const { error: saveError } = await admin
      .from("account_deletion_jobs")
      .update({ provider_revocation: outcomes })
      .eq("id", job.id);
    if (saveError) throw saveError;
  }
  return outcomes;
}

async function recordReceipt(admin: AdminClient, job: DeletionJobRow): Promise<void> {
  const { error } = await admin.from("account_deletion_receipts").upsert(
    {
      deletion_job_id: job.id,
      status_token_hash: job.status_token_hash,
      subject_hash: createHash("sha256").update(job.user_id, "utf8").digest("hex"),
      reason: job.reason,
      status: "processing",
      requested_at: job.requested_at,
      started_at: job.started_at ?? new Date().toISOString(),
      completed_at: null,
      step_summary: job.step_state,
    },
    { onConflict: "deletion_job_id" }
  );
  if (error) throw error;
}

async function scheduleDeletionRetry(
  admin: AdminClient,
  job: DeletionJobRow,
  step: string,
  reason: unknown
): Promise<"retry_wait" | "blocked"> {
  const blocked = job.attempts >= MAX_JOB_ATTEMPTS;
  const errorCode =
    reason instanceof ProviderRevocationRetryableError ? reason.code : "step_failed";
  const delaySeconds = Math.min(3600, 60 * 2 ** Math.max(0, job.attempts - 1));
  const status = blocked ? "blocked" : "retry_wait";
  await admin
    .from("account_deletion_jobs")
    .update({
      status,
      current_step: step,
      locked_at: null,
      last_error_class:
        reason instanceof ProviderRevocationRetryableError ? "provider_revocation" : "cleanup",
      last_error_code: errorCode,
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    })
    .eq("id", job.id);
  if (blocked) {
    await admin
      .from("account_deletion_receipts")
      .update({
        status: "blocked",
        step_summary: {
          ...job.step_state,
          providerRevocation: job.provider_revocation,
        },
      })
      .eq("deletion_job_id", job.id);
  }
  return status;
}

export async function processAccountDeletionJob(
  admin: AdminClient,
  jobId: string
): Promise<"not_claimed" | "completed" | "retry_wait" | "blocked"> {
  const { data: claimed, error: claimError } = await admin.rpc("claim_account_deletion_job", {
    p_job_id: jobId,
  });
  if (claimError) throw new AccountDeletionError("claim");
  const claim = (claimed as { job_id: string; user_id: string }[] | null)?.[0];
  if (!claim) return "not_claimed";

  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !data) throw new AccountDeletionError("load");
  const job = data as DeletionJobRow;
  await recordReceipt(admin, job);

  const steps: DeletionStep[] = [
    {
      name: "provider grant revocation",
      run: async () => {
        job.provider_revocation = (await updateProviderRevocations(
          admin,
          job
        )) as DeletionJobRow["provider_revocation"];
      },
    },
    ...buildAccountDeletionSteps(admin, job.user_id),
  ];

  for (const step of steps) {
    if (job.step_state[step.name]) continue;
    const { error: stepStartError } = await admin
      .from("account_deletion_jobs")
      .update({ current_step: step.name })
      .eq("id", job.id);
    if (stepStartError) return scheduleDeletionRetry(admin, job, step.name, stepStartError);

    try {
      await step.run();
    } catch (reason) {
      return scheduleDeletionRetry(admin, job, step.name, reason);
    }

    if (step.name === "authentication account and sessions") {
      const completedAt = new Date().toISOString();
      const { error: completionError } = await admin.rpc("complete_account_deletion_job", {
        p_job_id: job.id,
        p_completed_at: completedAt,
        p_step_summary: {
          ...job.step_state,
          [step.name]: completedAt,
          providerRevocation: job.provider_revocation,
        },
      });
      if (completionError) {
        return scheduleDeletionRetry(admin, job, step.name, completionError);
      }
      return "completed";
    }

    job.step_state = { ...job.step_state, [step.name]: new Date().toISOString() };
    const { error: saveError } = await admin
      .from("account_deletion_jobs")
      .update({ step_state: job.step_state })
      .eq("id", job.id);
    if (saveError) return scheduleDeletionRetry(admin, job, step.name, saveError);
  }

  return "completed";
}

export async function processDueAccountDeletionJobs(
  admin: AdminClient,
  limit = 10
): Promise<{ processed: number; completed: number; retrying: number; blocked: number }> {
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("id")
    .in("status", ["pending", "retry_wait", "processing"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("requested_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error) throw new AccountDeletionError("list");

  const result = { processed: 0, completed: 0, retrying: 0, blocked: 0 };
  for (const row of data ?? []) {
    const outcome = await processAccountDeletionJob(admin, String(row.id));
    if (outcome === "not_claimed") continue;
    result.processed += 1;
    if (outcome === "completed") result.completed += 1;
    if (outcome === "retry_wait") result.retrying += 1;
    if (outcome === "blocked") result.blocked += 1;
  }
  return result;
}

/** Compatibility helper for trusted callers and unit tests. */
export async function deleteUserAccount(admin: AdminClient, userId: string): Promise<void> {
  await runAccountDeletionSteps(buildAccountDeletionSteps(admin, userId));
}
