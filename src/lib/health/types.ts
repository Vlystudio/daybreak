/**
 * Types for Daybreak's source-aware health understanding layer.
 *
 * The core idea: Daybreak collects the SAME metric (e.g. resting HR, HRV, steps)
 * from multiple trackers, and each tracker is good at different things. Rather
 * than blindly merging them, we keep every source's value, pick a primary per a
 * deterministic policy, score confidence, and detect disagreements — so insights
 * are honest about where a number came from and how much to trust it.
 *
 * Daybreak is NOT a medical device: nothing here diagnoses; everything is framed
 * as personal pattern recognition relative to the user's own baseline.
 */

export type HealthSource =
  | "oura"
  | "apple_health"
  | "apple_watch"
  | "fitbit"
  | "manual"
  | "computed"
  | "unknown";

/**
 * Canonical metric names used across the fusion layer. HRV is intentionally a
 * single "hrv" signal whose sources are NOT averaged (Oura's overnight SDNN and
 * Apple's all-day SDNN measure different windows).
 */
export type HealthMetricName =
  // recovery / sleep (Oura-primary)
  | "sleep_duration_min"
  | "sleep_score"
  | "sleep_efficiency"
  | "deep_sleep_min"
  | "rem_sleep_min"
  | "light_sleep_min"
  | "readiness_score"
  | "hrv"
  | "resting_hr"
  | "body_temperature_delta"
  | "respiratory_rate"
  | "spo2_avg"
  // activity (Apple-primary)
  | "steps"
  | "distance_m"
  | "active_calories"
  | "exercise_minutes"
  | "stand_hours"
  | "workouts"
  // body
  | "weight_kg"
  | "body_fat_pct"
  | "vo2max"
  // subjective (manual-primary)
  | "mood"
  | "energy"
  | "stress"
  | "soreness";

export type Confidence = "high" | "medium" | "low";

export type MetricCategory =
  | "recovery"
  | "sleep"
  | "activity"
  | "vitals"
  | "stress"
  | "body"
  | "subjective";

/** A single source's value for one metric on one local day, with provenance. */
export interface RawHealthObservation {
  userId: string;
  date: string; // local YYYY-MM-DD
  metric: HealthMetricName;
  source: HealthSource;
  sourceDevice?: string | null;
  value: number | string | null;
  unit?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  importedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BaselineComparison {
  baselineValue: number;
  percentDifference: number; // (value - baseline) / baseline * 100
  absoluteDifference: number; // value - baseline
  baselineWindowDays: number;
}

/** The fused, source-aware understanding of one metric on one day. */
export interface DailyHealthSignal {
  userId: string;
  date: string;
  metric: HealthMetricName;
  value: number | string | null;
  unit?: string;
  primarySource: HealthSource;
  confidence: Confidence;
  confidenceScore: number; // 0..1
  confidenceReasons: string[];
  sourceValues: Record<string, number | string | null>;
  disagreementScore?: number; // 0..1; only when ≥2 numeric sources
  coverageScore?: number; // 0..1; fraction of expected sources present
  trendDirection?: "up" | "down" | "stable" | "unknown";
  baselineComparison?: BaselineComparison;
}

export interface SourceConflict {
  date: string;
  metric: HealthMetricName;
  sources: Partial<Record<HealthSource, number | string | null>>;
  severity: "minor" | "moderate" | "major";
  message: string;
  recommendedPrimarySource: HealthSource;
}

export interface HealthBaseline {
  metric: HealthMetricName;
  short: number | null; // ~7-day
  baseline: number | null; // ~30-day
  long: number | null; // ~60–90-day when available
  shortWindowDays: number;
  baselineWindowDays: number;
  longWindowDays: number;
  sampleCount: number; // days with a value in the loaded range
  confidence: Confidence; // history-length confidence
}

export type InsightType = "recovery" | "sleep" | "activity" | "vitals" | "stress" | "data_quality";
export type InsightSeverity = "positive" | "neutral" | "watch" | "warning";

export interface HealthInsight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  confidence: Confidence;
  reasons: string[];
  relatedMetrics: HealthMetricName[];
  sourceNotes?: string[];
}

export type RecoveryStatus = "strong" | "normal" | "watch" | "low" | "unknown";
export type SleepStatus = RecoveryStatus;
export type ActivityStatus = "high" | "normal" | "low" | "unknown";
export type StressStatus = "high" | "normal" | "low" | "unknown";

/**
 * Persistent, source-level provenance (the `health_observations` table). Where
 * `RawHealthObservation` is the in-memory shape the fusion layer consumes,
 * `HealthObservation` is the durable row: one metric value EXACTLY as one source
 * reported it, so Oura's HRV and Apple's HRV are distinct rows that are never
 * merged or averaged. The understanding layer reads these first and only falls
 * back to the legacy merged tables where observations are missing.
 */
export type HealthObservationSource = HealthSource;

/**
 * Observation metrics are the canonical {@link HealthMetricName}s the fusion
 * layer understands, plus a few provenance-only signals that are stored for
 * completeness but not (yet) fused — text notes/symptoms, instantaneous heart
 * rate, Oura's activity score, waist, and nutrition.
 */
export type HealthObservationMetric =
  | HealthMetricName
  | "heart_rate"
  | "activity_score"
  | "waist"
  | "notes"
  | "symptoms"
  | "nutrition";

/**
 * The grain of an observation. Everything written today is a `daily` aggregate
 * (or a `manual_entry`, which is also one-per-local-day). The finer grains exist
 * so a future intraday store (Apple Watch HR samples, workout HR streams, sleep
 * sessions, per-sample HRV) can be added without changing the daily rows — see
 * the limitation note in migration 0043.
 */
export type HealthObservationAggregation =
  | "daily"
  | "sample"
  | "workout"
  | "sleep_session"
  | "manual_entry";

/** A row of `health_observations` (camelCase). */
export interface HealthObservation {
  id: string;
  userId: string;
  source: HealthObservationSource;
  sourceDevice: string | null;
  sourceApp: string | null;
  sourceSampleId: string | null;
  metric: HealthObservationMetric;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  startTime: string | null;
  endTime: string | null;
  dateLocal: string; // local YYYY-MM-DD
  timezone: string | null;
  aggregationType: HealthObservationAggregation;
  metadata: Record<string, unknown>;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * An observation ready to be written. Optional fields default in the DB or the
 * upsert mapper; `metric` carries either a numeric value (`valueNumeric`) or a
 * text value (`valueText`), never neither.
 */
export interface NewHealthObservation {
  userId: string;
  source: HealthObservationSource;
  sourceDevice?: string | null;
  sourceApp?: string | null;
  sourceSampleId?: string | null;
  metric: HealthObservationMetric;
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  dateLocal: string;
  timezone?: string | null;
  /** Defaults to "daily" in the upsert mapper when omitted. */
  aggregationType?: HealthObservationAggregation;
  metadata?: Record<string, unknown>;
  importedAt?: string | null;
}

export interface HealthUnderstandingResult {
  dateRange: { from: string; to: string };
  dailySignals: DailyHealthSignal[];
  baselines: HealthBaseline[];
  insights: HealthInsight[];
  sourceConflicts: SourceConflict[];
  dataQuality: {
    overallConfidence: Confidence;
    connectedSources: string[];
    missingSources: string[];
    coverageByMetric: Record<string, number>;
    warnings: string[];
  };
  summary: {
    recoveryStatus: RecoveryStatus;
    sleepStatus: SleepStatus;
    activityStatus: ActivityStatus;
    stressStatus: StressStatus;
    topInsights: HealthInsight[];
  };
}
