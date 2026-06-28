import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import {
  upsertAppleHealthChunk,
  recordAppleHealthImport,
} from "@/lib/integrations/apple-health/ingest";
import { chunkSchema, summarySchema } from "@/lib/integrations/apple-health/schema";

/**
 * Phase 2 native HealthKit ingest. The Capacitor iOS app reads HealthKit on the
 * device via anchored queries and POSTs aggregated batches here. Auth is the
 * same Supabase session cookie the logged-in webview already carries — identity
 * comes only from getUser(), never the body. Shares the upsert/record helpers
 * with the Phase 1 export upload, so both paths persist identically.
 *
 * Body: { chunk?, summary? } — post data chunks, then a final post with a
 * summary to record the sync (source = "healthkit").
 */

const bodySchema = z.object({
  chunk: chunkSchema.optional(),
  // The native client already knows source = healthkit; force it server-side.
  summary: summarySchema.omit({ source: true }).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const limited = await rateLimit(`apple-import:${user.id}`, RATE_LIMITS.appleImport);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limited." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "body";
    return NextResponse.json(
      { error: `Invalid payload: ${where} — ${issue?.message ?? "unknown"}` },
      { status: 400 }
    );
  }
  const { chunk, summary } = parsed.data;

  let counts = { metrics: 0, workouts: 0, samples: 0 };
  if (chunk) {
    const result = await upsertAppleHealthChunk(user.id, chunk);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    counts = { metrics: result.metrics, workouts: result.workouts, samples: result.samples };
  }

  if (summary) {
    const recorded = await recordAppleHealthImport(user.id, { ...summary, source: "healthkit" });
    if (!recorded.ok) return NextResponse.json({ error: recorded.error }, { status: 500 });
    await audit(user.id, "health.imported", {
      entity: "apple_health",
      metadata: {
        source: "healthkit",
        days: summary.metricsDays,
        workouts: summary.workouts,
        samples: summary.samples,
      },
    });
  }

  return NextResponse.json({ ok: true, ...counts });
}
