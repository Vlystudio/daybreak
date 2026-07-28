"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { securityRateLimit } from "@/lib/rate-limit";
import {
  buildLegacyAppleCleanupPatches,
  type ObservationKey,
} from "@/lib/integrations/apple-health/source-cleanup";
import {
  upsertAppleHealthChunk,
  recordAppleHealthImport,
} from "@/lib/integrations/apple-health/ingest";
import type {
  AppleHealthChunk,
  ChunkResult,
  ImportSummary,
} from "@/lib/integrations/apple-health/schema";

/**
 * Receives Apple Health import data that the browser parsed out of the user's
 * "Export All Health Data" zip (see lib/integrations/apple-health/parse). The
 * export is too big to send whole, so the client streams it in chunks; each
 * chunk upserts via the shared ingest helpers, scoped to the signed-in user.
 * `finalizeAppleHealthImport` writes the completion record.
 *
 * NOTE: a "use server" module may export ONLY async functions — re-exporting
 * these types from here crashes the whole page's server-actions bundle
 * ("AppleHealthChunk is not defined"). Import the types from ./schema instead.
 */

export async function importAppleHealthChunk(chunk: AppleHealthChunk): Promise<ChunkResult> {
  const user = await requireUser();

  const limited = await rateLimit(`apple-import:${user.id}`, RATE_LIMITS.appleImport);
  if (!limited.ok) return { ok: false, error: "Importing too fast — pause a moment and retry." };

  return upsertAppleHealthChunk(user.id, chunk);
}

export async function finalizeAppleHealthImport(
  summary: ImportSummary
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const result = await recordAppleHealthImport(user.id, { ...summary, source: "file" });
  if (!result.ok) return result;

  await audit(user.id, "health.imported", {
    entity: "apple_health",
    metadata: {
      source: "file",
      days: summary.metricsDays,
      workouts: summary.workouts,
      samples: summary.samples,
    },
  });
  revalidatePath("/health");
  revalidatePath("/settings");
  return { ok: true };
}

/** Stop server-side Apple Health use and optionally erase only Apple-sourced data. */
export async function disconnectAppleHealth(input: {
  deleteData: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const limited = await securityRateLimit(`apple-disconnect:${user.id}`, RATE_LIMITS.disconnect);
  if (!limited.ok) return { ok: false, error: "Too many changes—try again shortly." };

  if (!input || typeof input.deleteData !== "boolean") {
    return { ok: false, error: "Invalid Apple Health disconnect request." };
  }
  if (!input.deleteData) {
    const admin = createAdminClient();
    const { error } = await admin.from("apple_health_imports").delete().eq("user_id", user.id);
    if (error) return { ok: false, error: "Couldn't disconnect Apple Health." };
    revalidatePath("/settings");
    return { ok: true };
  }

  const admin = createAdminClient();
  const { data: appleRows, error: readError } = await admin
    .from("health_observations")
    .select("date_local, metric")
    .eq("user_id", user.id)
    .in("source", ["apple_health", "apple_watch"])
    .returns<ObservationKey[]>();
  if (readError) return { ok: false, error: "Couldn't prepare Apple Health data removal." };

  const steps = [
    admin.from("health_daily_samples").delete().eq("user_id", user.id),
    admin.from("health_workouts").delete().eq("user_id", user.id).eq("source", "apple"),
    admin.from("apple_health_imports").delete().eq("user_id", user.id),
    admin
      .from("health_observations")
      .delete()
      .eq("user_id", user.id)
      .in("source", ["apple_health", "apple_watch"]),
  ];
  const results = await Promise.all(steps);
  if (results.some((result) => result.error)) {
    return { ok: false, error: "Some Apple Health data couldn't be removed. Please retry." };
  }

  if ((appleRows ?? []).length > 0) {
    const dates = [...new Set((appleRows ?? []).map((row) => row.date_local))];
    const { data: remaining, error } = await admin
      .from("health_observations")
      .select("date_local, metric")
      .eq("user_id", user.id)
      .in("date_local", dates)
      .returns<ObservationKey[]>();
    if (error) return { ok: false, error: "Apple data was removed, but summaries need cleanup." };
    const patches = buildLegacyAppleCleanupPatches(appleRows ?? [], remaining ?? []);
    for (const [date, patch] of patches) {
      const { error: patchError } = await admin
        .from("health_metrics")
        .update(patch)
        .eq("user_id", user.id)
        .eq("date", date);
      if (patchError) {
        return { ok: false, error: "Apple data was removed, but a daily summary needs cleanup." };
      }
    }
  }

  await audit(user.id, "connection.unlinked", {
    entity: "apple_health",
    metadata: { deleted_data: true },
  });
  revalidatePath("/health");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
