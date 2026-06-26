/**
 * Shared Apple Health import types. No browser/fflate imports here so the
 * server action can import the type list too. The actual parsing lives in
 * ./parse (client-only — it streams the export zip in the browser).
 */

/**
 * The health_metrics columns the Apple Health import can populate. Apple has no
 * readiness/sleep *score*, so those are absent. Used as the server-side
 * allow-list when upserting a parsed day.
 */
export const APPLE_METRIC_FIELDS = [
  "hrv_avg",
  "resting_hr",
  "respiratory_rate",
  "spo2_avg",
  "steps",
  "active_calories",
  "total_calories",
  "sleep_duration_min",
  "sleep_efficiency",
  "deep_sleep_min",
  "rem_sleep_min",
  "light_sleep_min",
  "weight_kg",
  "body_fat_pct",
  "vo2max",
  "exercise_minutes",
  "stand_hours",
  "distance_m",
] as const;

export type AppleMetricField = (typeof APPLE_METRIC_FIELDS)[number];

/** One health_metrics row's worth of data for a single local day. */
export type AppleDailyMetric = { date: string } & Partial<Record<AppleMetricField, number>>;

export interface AppleWorkout {
  /** Deterministic dedup key (activity + start + duration), since the XML export has no UUID. */
  external_id: string;
  activity_type: string;
  started_at: string; // ISO 8601 (UTC)
  ended_at: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  active_energy_kcal: number | null;
  total_energy_kcal: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  metadata: Record<string, string>;
}

/** Per-day aggregate of one HealthKit quantity type — the flexible long tail. */
export interface AppleDailySample {
  date: string;
  type: string;
  unit: string | null;
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface AppleHealthParseResult {
  metrics: AppleDailyMetric[];
  workouts: AppleWorkout[];
  samples: AppleDailySample[];
  rangeStart: string | null; // earliest day seen, YYYY-MM-DD
  rangeEnd: string | null; // latest day seen, YYYY-MM-DD
  recordCount: number; // total <Record> elements scanned (for UX)
  truncatedSamples: boolean; // long-tail samples were capped
}

/** Safety cap on long-tail (date,type) sample rows for a multi-year export. */
export const MAX_DAILY_SAMPLES = 50_000;
