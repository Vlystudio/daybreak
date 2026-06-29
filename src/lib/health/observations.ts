import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  HealthObservation,
  HealthObservationAggregation,
  HealthObservationMetric,
  HealthObservationSource,
  NewHealthObservation,
} from "./types";
import { dedupeObservations } from "./observation-mappers";

/**
 * Server-only read/write helpers for the `health_observations` table. The pure
 * mappers (`./observation-mappers`) build the rows; this module persists and
 * reads them via the service-role client. Re-exports the mappers so callers have
 * a single import surface.
 */

export {
  toHealthObservationInput,
  normalizeObservationDate,
  dedupeObservations,
  dailyMetricsToObservations,
  appleChunkToObservations,
  subjectiveCheckinToObservations,
  bodyMeasurementToObservations,
  mergeObservationSources,
  attributionForSource,
  legacyObservationsToBackfillRows,
} from "./observation-mappers";

/** The shape returned by `select(OBSERVATION_COLUMNS)`. */
interface ObservationRow {
  id: string;
  user_id: string;
  source: string;
  source_device: string | null;
  source_app: string | null;
  source_sample_id: string | null;
  metric: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  start_time: string | null;
  end_time: string | null;
  date_local: string;
  timezone: string | null;
  aggregation_type: string;
  metadata: Record<string, unknown> | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

const OBSERVATION_COLUMNS =
  "id, user_id, source, source_device, source_app, source_sample_id, metric, value_numeric, value_text, unit, start_time, end_time, date_local, timezone, aggregation_type, metadata, imported_at, created_at, updated_at";

function rowToObservation(r: ObservationRow): HealthObservation {
  return {
    id: r.id,
    userId: r.user_id,
    source: r.source as HealthObservationSource,
    sourceDevice: r.source_device,
    sourceApp: r.source_app,
    sourceSampleId: r.source_sample_id,
    metric: r.metric as HealthObservationMetric,
    valueNumeric: r.value_numeric,
    valueText: r.value_text,
    unit: r.unit,
    startTime: r.start_time,
    endTime: r.end_time,
    dateLocal: r.date_local,
    timezone: r.timezone,
    aggregationType: (r.aggregation_type as HealthObservationAggregation) ?? "daily",
    metadata: r.metadata ?? {},
    importedAt: r.imported_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toInsertRow(o: NewHealthObservation, now: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: o.userId,
    source: o.source,
    source_device: o.sourceDevice ?? null,
    source_app: o.sourceApp ?? null,
    source_sample_id: o.sourceSampleId ?? null,
    metric: o.metric,
    value_numeric: o.valueNumeric ?? null,
    value_text: o.valueText ?? null,
    unit: o.unit ?? null,
    start_time: o.startTime ?? null,
    end_time: o.endTime ?? null,
    date_local: o.dateLocal,
    timezone: o.timezone ?? null,
    aggregation_type: o.aggregationType ?? "daily",
    metadata: o.metadata ?? {},
    updated_at: now,
  };
  // Only set imported_at when provided, so the DB default (now()) applies otherwise.
  if (o.importedAt) row.imported_at = o.importedAt;
  return row;
}

export interface UpsertObservationsOptions {
  /**
   * Insert-only mode (ON CONFLICT DO NOTHING): never overwrite an existing row
   * on the daily key. Used by the backfill so seeding history can't clobber a
   * newer exact observation, and so the returned count is the number actually
   * inserted (existing rows are skipped). Default false = overwrite (live sync).
   */
  ignoreDuplicates?: boolean;
}

/**
 * Idempotently upsert observations onto the daily-aggregate grain
 * (user_id, source, metric, date_local). Deduped first so a single batch can't
 * collide with itself.
 *
 * Default (live sync): upsert/overwrite, returns the number of rows written.
 * `ignoreDuplicates`: insert-only, returns the number of rows actually inserted.
 */
export async function upsertHealthObservations(
  observations: NewHealthObservation[],
  options: UpsertObservationsOptions = {}
): Promise<number> {
  const deduped = dedupeObservations(observations);
  if (deduped.length === 0) return 0;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const rows = deduped.map((o) => toInsertRow(o, now));

  if (options.ignoreDuplicates) {
    // DO NOTHING on conflict; .select() returns only the newly-inserted rows.
    const { data, error } = await admin
      .from("health_observations")
      .upsert(rows, { onConflict: "user_id,source,metric,date_local", ignoreDuplicates: true })
      .select("id")
      .returns<{ id: string }[]>();
    if (error) throw new Error(`Failed to insert health observations: ${error.message}`);
    return data?.length ?? 0;
  }

  const { error } = await admin
    .from("health_observations")
    .upsert(rows, { onConflict: "user_id,source,metric,date_local" });
  if (error) throw new Error(`Failed to upsert health observations: ${error.message}`);

  return rows.length;
}

/** All of a user's observations in `[from, to]` (inclusive, local dates). */
export async function getHealthObservations(
  userId: string,
  from: string,
  to: string
): Promise<HealthObservation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("health_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("user_id", userId)
    .gte("date_local", from)
    .lte("date_local", to)
    .order("date_local", { ascending: true })
    .returns<ObservationRow[]>();
  if (error) throw new Error(`Failed to load health observations: ${error.message}`);
  return (data ?? []).map(rowToObservation);
}

/** A user's observations for one metric in `[from, to]`, across every source. */
export async function getHealthObservationsByMetric(
  userId: string,
  metric: HealthObservationMetric,
  from: string,
  to: string
): Promise<HealthObservation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("health_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("user_id", userId)
    .eq("metric", metric)
    .gte("date_local", from)
    .lte("date_local", to)
    .order("date_local", { ascending: true })
    .returns<ObservationRow[]>();
  if (error) throw new Error(`Failed to load health observations for ${metric}: ${error.message}`);
  return (data ?? []).map(rowToObservation);
}
