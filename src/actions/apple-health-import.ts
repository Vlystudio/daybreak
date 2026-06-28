"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
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
