import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient & {
  auth: SupabaseClient["auth"] & {
    admin: { deleteUser(userId: string): Promise<{ error: Error | null }> };
  };
};

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

export async function deleteUserAccount(admin: AdminClient, userId: string): Promise<void> {
  await runAccountDeletionSteps([
    { name: "storage", run: () => removeUserStorage(admin, userId) },
    {
      name: "provider credentials and notifications",
      run: async () => {
        await Promise.all([
          expectNoError(admin.from("oauth_connections").delete().eq("user_id", userId)),
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
          expectNoError(admin.from("recipes").delete().eq("created_by", userId)),
          expectNoError(admin.from("product_prices").delete().eq("recorded_by", userId)),
          expectNoError(
            admin.from("products").update({ created_by: null }).eq("created_by", userId)
          ),
        ]);
      },
    },
    {
      name: "authentication account",
      run: async () => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    },
  ]);
}
