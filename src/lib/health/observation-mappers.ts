/**
 * Pure mappers for the `health_observations` provenance layer. NO server-only or
 * admin-client imports here, so these are unit-testable and safe to import from
 * either a Server Action or a route. The DB read/write helpers live in
 * `./observations` (server-only) and re-export everything below.
 *
 * Every source's value becomes its own row, tagged with the exact source. Oura's
 * HRV and Apple's HRV are therefore distinct observations that are never merged
 * or averaged — the fusion layer selects between them per policy.
 */

import type {
  HealthMetricName,
  HealthObservationAggregation,
  HealthObservationMetric,
  HealthObservationSource,
  HealthSource,
  NewHealthObservation,
  RawHealthObservation,
} from "./types";
import { ALL_METRICS, policyFor } from "./source-policies";
import type { DailyMetrics } from "../integrations/oura";
import type { AppleMetricField } from "../integrations/apple-health/types";

// ── Units ────────────────────────────────────────────────────────────────────

const FUSION_METRICS = new Set<string>(ALL_METRICS);

/**
 * Explicit, canonical units for every metric whose fusion policy leaves the unit
 * undefined (counts, 0–100 scores, the 1–5 subjective scales) plus the
 * provenance-only metrics. This keeps `unit` populated and consistent rather than
 * null: steps/workouts are counts; HRV is ms; sleep durations are minutes;
 * energy is kcal (from policy); weight is kg (from policy).
 */
const FALLBACK_UNITS: Partial<Record<HealthObservationMetric, string>> = {
  steps: "count",
  workouts: "count",
  sleep_score: "score",
  readiness_score: "score",
  activity_score: "score",
  mood: "score",
  energy: "score",
  stress: "score",
  soreness: "score",
  heart_rate: "bpm",
  waist: "cm",
};

function isFusionMetric(metric: HealthObservationMetric): metric is HealthMetricName {
  return FUSION_METRICS.has(metric);
}

function unitFor(metric: HealthObservationMetric): string | null {
  const policyUnit = isFusionMetric(metric) ? policyFor(metric).unit : undefined;
  return policyUnit ?? FALLBACK_UNITS[metric] ?? null;
}

// ── Date normalization ───────────────────────────────────────────────────────

/**
 * Resolve any input to a stable local `YYYY-MM-DD`. A bare date string is already
 * local and is returned as-is; an ISO datetime or `Date` is formatted in the
 * given IANA timezone (default UTC), matching how the rest of the app derives
 * "today" for a user.
 */
export function normalizeObservationDate(input: string | Date, timezone?: string | null): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) {
    const lead = typeof input === "string" ? input.match(/^\d{4}-\d{2}-\d{2}/) : null;
    return lead ? lead[0] : new Date().toISOString().slice(0, 10);
  }
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface ObservationInput {
  userId: string;
  source: HealthObservationSource;
  metric: HealthObservationMetric;
  date: string | Date;
  value: number | string | null;
  unit?: string | null;
  sourceDevice?: string | null;
  sourceApp?: string | null;
  sourceSampleId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  /** Defaults to "daily" — the only grain anything writes today. */
  aggregationType?: HealthObservationAggregation;
  importedAt?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Normalize one raw value into a writable observation. Numeric values land in
 * `valueNumeric`; non-empty strings in `valueText`; units default from policy.
 */
export function toHealthObservationInput(params: ObservationInput): NewHealthObservation {
  const numeric =
    typeof params.value === "number" && Number.isFinite(params.value) ? params.value : null;
  const text =
    typeof params.value === "string" && params.value.trim().length > 0 ? params.value.trim() : null;
  return {
    userId: params.userId,
    source: params.source,
    sourceDevice: params.sourceDevice ?? null,
    sourceApp: params.sourceApp ?? null,
    sourceSampleId: params.sourceSampleId ?? null,
    metric: params.metric,
    valueNumeric: numeric,
    valueText: text,
    unit: params.unit ?? unitFor(params.metric),
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
    dateLocal: normalizeObservationDate(params.date, params.timezone),
    timezone: params.timezone ?? null,
    aggregationType: params.aggregationType ?? "daily",
    metadata: params.metadata ?? {},
    importedAt: params.importedAt ?? null,
  };
}

// ── Dedupe ───────────────────────────────────────────────────────────────────

/** The daily-aggregate grain — also the DB upsert conflict target. */
function dailyKey(o: NewHealthObservation): string {
  return `${o.userId}|${o.source}|${o.metric}|${o.dateLocal}`;
}

/**
 * Collapse duplicates so a re-sync (or the same value arriving twice) never
 * violates a unique index or doubles a row. Exact `source_sample_id` matches
 * collapse first — scoped by (user_id, source) to mirror the DB index, so the
 * SAME raw sample id from a different user or a different source stays distinct.
 * Everything then collapses to the per-day grain (last wins).
 */
export function dedupeObservations(list: NewHealthObservation[]): NewHealthObservation[] {
  const bySample = new Map<string, NewHealthObservation>();
  const noSample: NewHealthObservation[] = [];
  for (const o of list) {
    if (o.sourceSampleId) bySample.set(`${o.userId}|${o.source}|${o.sourceSampleId}`, o);
    else noSample.push(o);
  }
  const byDay = new Map<string, NewHealthObservation>();
  for (const o of [...bySample.values(), ...noSample]) byDay.set(dailyKey(o), o);
  return [...byDay.values()];
}

// ── Source mappers ───────────────────────────────────────────────────────────

/** Oura/Fitbit `DailyMetrics` field → canonical observation metric. */
const WEARABLE_FIELD_TO_METRIC: Partial<Record<keyof DailyMetrics, HealthObservationMetric>> = {
  sleep_duration_min: "sleep_duration_min",
  sleep_score: "sleep_score",
  sleep_efficiency: "sleep_efficiency",
  deep_sleep_min: "deep_sleep_min",
  rem_sleep_min: "rem_sleep_min",
  light_sleep_min: "light_sleep_min",
  readiness_score: "readiness_score",
  hrv_avg: "hrv",
  resting_hr: "resting_hr",
  body_temperature_delta: "body_temperature_delta",
  respiratory_rate: "respiratory_rate",
  spo2_avg: "spo2_avg",
  steps: "steps",
  active_calories: "active_calories",
  activity_score: "activity_score",
};

/**
 * Wearable daily metrics → observations. Shared by Oura (`source: "oura"`) and
 * Fitbit (`source: "fitbit"`), which return the same `DailyMetrics` shape.
 */
export function dailyMetricsToObservations(
  userId: string,
  metrics: ReadonlyArray<DailyMetrics>,
  source: HealthObservationSource
): NewHealthObservation[] {
  const out: NewHealthObservation[] = [];
  for (const row of metrics) {
    for (const [field, metric] of Object.entries(WEARABLE_FIELD_TO_METRIC)) {
      if (!metric) continue;
      const value = row[field as keyof DailyMetrics];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      out.push(
        toHealthObservationInput({
          userId,
          source,
          metric,
          date: row.date,
          value,
          metadata: { provider: source },
        })
      );
    }
  }
  return dedupeObservations(out);
}

/** Apple `AppleDailyMetric` field → canonical observation metric. */
const APPLE_FIELD_TO_METRIC: Partial<Record<AppleMetricField, HealthObservationMetric>> = {
  hrv_avg: "hrv",
  resting_hr: "resting_hr",
  respiratory_rate: "respiratory_rate",
  spo2_avg: "spo2_avg",
  steps: "steps",
  active_calories: "active_calories",
  sleep_duration_min: "sleep_duration_min",
  sleep_efficiency: "sleep_efficiency",
  deep_sleep_min: "deep_sleep_min",
  rem_sleep_min: "rem_sleep_min",
  light_sleep_min: "light_sleep_min",
  weight_kg: "weight_kg",
  body_fat_pct: "body_fat_pct",
  vo2max: "vo2max",
  exercise_minutes: "exercise_minutes",
  stand_hours: "stand_hours",
  distance_m: "distance_m",
};

/**
 * Apple Health / HealthKit chunk → observations.
 *
 * Source attribution (intentional limitation): the chunk is a per-day AGGREGATE
 * with no per-sample device/source provenance, so we cannot tell whether a given
 * value came from the Apple Watch, the iPhone, or a third-party app that wrote
 * into HealthKit. We therefore attribute to `apple_health` (the umbrella source)
 * rather than guessing `apple_watch`. A caller that *knows* the device — e.g. a
 * future native ingest that reads HKSource/HKDevice per sample — can pass
 * `source: "apple_watch"`. Apple HRV stays a distinct row from Oura HRV; the two
 * are never averaged (different measurement windows). Every row is a `daily`
 * aggregate, including the per-day workout count.
 */
export function appleChunkToObservations(
  userId: string,
  chunk: {
    metrics?: ReadonlyArray<Record<string, unknown>>;
    workouts?: ReadonlyArray<{ started_at: string }>;
  },
  source: HealthObservationSource = "apple_health"
): NewHealthObservation[] {
  const out: NewHealthObservation[] = [];

  // `metrics` is the validated-but-dynamically-typed chunk shape, so read each
  // field defensively (date is a string; every metric field is a number).
  for (const row of chunk.metrics ?? []) {
    const date = row.date;
    if (typeof date !== "string") continue;
    for (const [field, metric] of Object.entries(APPLE_FIELD_TO_METRIC)) {
      if (!metric) continue;
      const value = row[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      out.push(
        toHealthObservationInput({
          userId,
          source,
          metric,
          date,
          value,
          metadata: { provider: "apple" },
        })
      );
    }
  }

  // Workout count per local day (started_at is UTC; bucket by its calendar day).
  const byDay = new Map<string, number>();
  for (const w of chunk.workouts ?? []) {
    const d = normalizeObservationDate(w.started_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  for (const [date, count] of byDay) {
    out.push(
      toHealthObservationInput({
        userId,
        source,
        metric: "workouts",
        date,
        value: count,
        metadata: { provider: "apple", kind: "workout_count" },
      })
    );
  }

  return dedupeObservations(out);
}

/** A subjective check-in row → manual observations (mood/energy/stress/soreness + note). */
export function subjectiveCheckinToObservations(
  userId: string,
  checkin: {
    date: string;
    mood: number | null;
    energy: number | null;
    stress: number | null;
    soreness: number | null;
    note?: string | null;
  }
): NewHealthObservation[] {
  const out: NewHealthObservation[] = [];
  for (const metric of ["mood", "energy", "stress", "soreness"] as const) {
    const v = checkin[metric];
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push(
        toHealthObservationInput({
          userId,
          source: "manual",
          metric,
          date: checkin.date,
          value: v,
          aggregationType: "manual_entry",
        })
      );
    }
  }
  // The free-text note is stored as value_text (never value_numeric).
  if (checkin.note && checkin.note.trim().length > 0) {
    out.push(
      toHealthObservationInput({
        userId,
        source: "manual",
        metric: "notes",
        date: checkin.date,
        value: checkin.note,
        aggregationType: "manual_entry",
      })
    );
  }
  return dedupeObservations(out);
}

/** A body-measurement row → manual observations (weight/body fat). */
export function bodyMeasurementToObservations(
  userId: string,
  m: { date: string; weight_kg: number | null; body_fat_pct: number | null }
): NewHealthObservation[] {
  const out: NewHealthObservation[] = [];
  if (typeof m.weight_kg === "number" && Number.isFinite(m.weight_kg)) {
    out.push(
      toHealthObservationInput({
        userId,
        source: "manual",
        metric: "weight_kg",
        date: m.date,
        value: m.weight_kg,
        aggregationType: "manual_entry",
      })
    );
  }
  if (typeof m.body_fat_pct === "number" && Number.isFinite(m.body_fat_pct)) {
    out.push(
      toHealthObservationInput({
        userId,
        source: "manual",
        metric: "body_fat_pct",
        date: m.date,
        value: m.body_fat_pct,
        aggregationType: "manual_entry",
      })
    );
  }
  return dedupeObservations(out);
}

// ── Merge (observations-first with legacy fallback) ──────────────────────────

/**
 * Prefer exact observations, fill gaps from legacy-derived rows. A legacy row is
 * dropped when an observation already covers the same (date, metric, source), so
 * the precise value always wins. `usedLegacy` is true when any legacy row was
 * needed — the understanding layer surfaces that as a data-quality warning.
 */
export function mergeObservationSources(
  primary: RawHealthObservation[],
  legacy: RawHealthObservation[]
): { observations: RawHealthObservation[]; usedLegacy: boolean } {
  const key = (o: RawHealthObservation) => `${o.date}|${o.metric}|${o.source}`;
  const have = new Set(primary.map(key));
  const extra = legacy.filter((o) => !have.has(key(o)));
  return { observations: [...primary, ...extra], usedLegacy: extra.length > 0 };
}

// ── Backfill (legacy-derived → writable rows) ────────────────────────────────

export type SourceAttribution = "exact" | "legacy_best_effort";

/**
 * Provenance attribution for a backfilled value. Apple's own per-type data and
 * manual self-reports are exact; values read from the merged health_metrics
 * store (Oura/Fitbit) are best-effort, since that table can't distinguish a
 * wearable from Apple after the fact.
 */
export function attributionForSource(source: HealthSource): SourceAttribution {
  return source === "apple_health" || source === "apple_watch" || source === "manual"
    ? "exact"
    : "legacy_best_effort";
}

export interface BackfillBuild {
  rows: NewHealthObservation[];
  bySource: Record<string, number>;
  byAttribution: Record<SourceAttribution, number>;
}

/**
 * Convert legacy-derived observations into writable rows tagged for backfill.
 * Pure (no DB) so it's unit-testable; the caller persists `rows`. Each row
 * records `metadata.backfilled = true` and `metadata.source_attribution`, and
 * manual rows carry the `manual_entry` grain to match the live dual-write path.
 */
export function legacyObservationsToBackfillRows(
  userId: string,
  observations: ReadonlyArray<RawHealthObservation>
): BackfillBuild {
  const bySource: Record<string, number> = {};
  const byAttribution: Record<SourceAttribution, number> = { exact: 0, legacy_best_effort: 0 };
  const rows: NewHealthObservation[] = [];
  for (const o of observations) {
    // The legacy derivation only produces numeric values.
    if (typeof o.value !== "number" || !Number.isFinite(o.value)) continue;
    const attribution = attributionForSource(o.source);
    bySource[o.source] = (bySource[o.source] ?? 0) + 1;
    byAttribution[attribution] += 1;
    rows.push(
      toHealthObservationInput({
        userId,
        source: o.source,
        metric: o.metric,
        date: o.date,
        value: o.value,
        unit: o.unit ?? null,
        sourceDevice: o.sourceDevice ?? null,
        importedAt: o.importedAt ?? null,
        aggregationType: o.source === "manual" ? "manual_entry" : "daily",
        metadata: { ...(o.metadata ?? {}), backfilled: true, source_attribution: attribution },
      })
    );
  }
  return { rows, bySource, byAttribution };
}
