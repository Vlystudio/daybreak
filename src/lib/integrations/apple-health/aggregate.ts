import type {
  AppleDailyMetric,
  AppleDailySample,
  AppleHealthParseResult,
  AppleMetricField,
  AppleWorkout,
} from "./types";
import { MAX_DAILY_SAMPLES } from "./types";

/**
 * Shared aggregation core for Apple Health, used by BOTH ingestion paths so they
 * produce identical data with no drift:
 *   • the Phase 1 browser export parser (./parse) feeds XML records in
 *   • the Phase 2 native HealthKit client (./healthkit.client) feeds HKSamples in
 *
 * Both call the same add* methods; `result()` returns daily metrics, workouts,
 * and the per-day long tail. No browser/native imports here — pure data.
 */

// ── Unit conversions ─────────────────────────────────────────────────────────

export function toMeters(v: number, unit: string): number {
  switch (unit) {
    case "km":
      return v * 1000;
    case "mi":
      return v * 1609.344;
    case "ft":
      return v * 0.3048;
    case "yd":
      return v * 0.9144;
    default:
      return v; // m
  }
}

export function toKcal(v: number, unit: string): number {
  if (unit === "kJ") return v / 4.184;
  return v; // kcal / Cal
}

export function toKg(v: number, unit: string): number {
  switch (unit) {
    case "lb":
      return v * 0.453592;
    case "g":
      return v / 1000;
    case "st":
      return v * 6.35029;
    default:
      return v; // kg
  }
}

/** Body-fat % and SpO₂ may arrive as a 0–1 fraction; normalize to 0–100. */
export function toPercent(v: number): number {
  return v <= 1 ? v * 100 : v;
}

// ── Quantity-type → health_metrics field mapping ─────────────────────────────

type Agg = "sum" | "avg";
interface MetricMap {
  field: AppleMetricField | "__basal";
  agg: Agg;
  convert?: (value: number, unit: string) => number;
}

export const QUANTITY_MAP: Record<string, MetricMap> = {
  HKQuantityTypeIdentifierStepCount: { field: "steps", agg: "sum" },
  HKQuantityTypeIdentifierDistanceWalkingRunning: {
    field: "distance_m",
    agg: "sum",
    convert: toMeters,
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    field: "active_calories",
    agg: "sum",
    convert: toKcal,
  },
  HKQuantityTypeIdentifierBasalEnergyBurned: { field: "__basal", agg: "sum", convert: toKcal },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { field: "hrv_avg", agg: "avg" },
  HKQuantityTypeIdentifierRestingHeartRate: { field: "resting_hr", agg: "avg" },
  HKQuantityTypeIdentifierRespiratoryRate: { field: "respiratory_rate", agg: "avg" },
  HKQuantityTypeIdentifierOxygenSaturation: { field: "spo2_avg", agg: "avg", convert: toPercent },
  HKQuantityTypeIdentifierBodyMass: { field: "weight_kg", agg: "avg", convert: toKg },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    field: "body_fat_pct",
    agg: "avg",
    convert: toPercent,
  },
  HKQuantityTypeIdentifierVO2Max: { field: "vo2max", agg: "avg" },
  HKQuantityTypeIdentifierAppleExerciseTime: { field: "exercise_minutes", agg: "sum" },
};

/** Quantity types that map to a daily metric — the native client requests these
 *  plus anything else it wants stored in the long-tail samples table. */
export const MAPPED_QUANTITY_TYPES = Object.keys(QUANTITY_MAP).filter((t) => t !== "__basal");

/** Small deterministic hash (djb2). */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Stable workout dedup key. Derived from normalized fields (activity + ISO start
 * + duration in seconds) so the file-export and native HealthKit paths produce
 * the SAME id for the same workout — re-importing one after the other is
 * idempotent rather than duplicating.
 */
export function workoutExternalId(
  activity: string,
  startedAtIso: string,
  durationSec: number | null
): string {
  return djb2(`${activity}|${startedAtIso}|${durationSec ?? ""}`);
}

const AVG_FIELDS = new Set<string>();
for (const m of Object.values(QUANTITY_MAP)) if (m.agg === "avg") AVG_FIELDS.add(m.field);

// ── Sleep value buckets ──────────────────────────────────────────────────────

type SleepBucket = "inBed" | "deep" | "rem" | "light" | "ignore";

export function sleepBucket(value: string): SleepBucket {
  switch (value) {
    case "HKCategoryValueSleepAnalysisInBed":
      return "inBed";
    case "HKCategoryValueSleepAnalysisAsleepDeep":
      return "deep";
    case "HKCategoryValueSleepAnalysisAsleepREM":
      return "rem";
    case "HKCategoryValueSleepAnalysisAsleepCore":
    case "HKCategoryValueSleepAnalysisAsleepUnspecified":
    case "HKCategoryValueSleepAnalysisAsleep":
      return "light";
    default:
      return "ignore"; // Awake
  }
}

interface SampleAcc {
  unit: string | null;
  sum: number;
  min: number;
  max: number;
  count: number;
}
interface SleepAcc {
  inBed: number;
  deep: number;
  rem: number;
  light: number;
  asleep: number;
}

function round(field: string, v: number): number {
  if (
    field === "hrv_avg" ||
    field === "spo2_avg" ||
    field === "weight_kg" ||
    field === "body_fat_pct" ||
    field === "vo2max" ||
    field === "respiratory_rate"
  )
    return Math.round(v * 10) / 10;
  return Math.round(v);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export class DailyAggregator {
  recordCount = 0;

  private metricSum = new Map<string, Map<string, number>>();
  private metricCnt = new Map<string, Map<string, number>>();
  private basal = new Map<string, number>();
  private sleep = new Map<string, SleepAcc>();
  private samples = new Map<string, SampleAcc>(); // `${date} ${type}`
  private workouts: AppleWorkout[] = [];
  private workoutIds = new Set<string>();
  private minDay: string | null = null;
  private maxDay: string | null = null;

  noteDay(day: string): void {
    if (!this.minDay || day < this.minDay) this.minDay = day;
    if (!this.maxDay || day > this.maxDay) this.maxDay = day;
  }

  /** A single quantity sample on a given local day. */
  addQuantity(type: string, value: number, unit: string, day: string): void {
    this.recordCount++;
    if (!Number.isFinite(value)) return;
    this.noteDay(day);

    // Long-tail: every numeric quantity, in its original unit.
    const key = `${day} ${type}`;
    let s = this.samples.get(key);
    if (!s) {
      s = { unit: unit || null, sum: 0, min: value, max: value, count: 0 };
      this.samples.set(key, s);
    }
    s.sum += value;
    if (value < s.min) s.min = value;
    if (value > s.max) s.max = value;
    s.count++;

    // Mapped daily metric.
    const map = QUANTITY_MAP[type];
    if (map) {
      const v = map.convert ? map.convert(value, unit) : value;
      if (map.field === "__basal") this.basal.set(day, (this.basal.get(day) ?? 0) + v);
      else this.addMetric(day, map.field, v);
    }
  }

  /** One sleep segment, in minutes, attributed to the day it ended (the morning). */
  addSleepSegment(endDay: string, value: string, minutes: number): void {
    this.recordCount++;
    if (!(minutes > 0)) return;
    const bucket = sleepBucket(value);
    if (bucket === "ignore") return;
    this.noteDay(endDay);
    let acc = this.sleep.get(endDay);
    if (!acc) {
      acc = { inBed: 0, deep: 0, rem: 0, light: 0, asleep: 0 };
      this.sleep.set(endDay, acc);
    }
    if (bucket === "inBed") acc.inBed += minutes;
    else {
      acc[bucket] += minutes;
      acc.asleep += minutes;
    }
  }

  /** Authoritative ring values for a day (from ActivitySummary). */
  setActivityRings(day: string, exerciseMinutes?: number, standHours?: number): void {
    this.noteDay(day);
    if (exerciseMinutes != null && Number.isFinite(exerciseMinutes))
      this.setMetric(day, "exercise_minutes", Math.round(exerciseMinutes));
    if (standHours != null && Number.isFinite(standHours))
      this.setMetric(day, "stand_hours", Math.round(standHours));
  }

  addWorkout(w: AppleWorkout): void {
    if (this.workoutIds.has(w.external_id)) return;
    this.workoutIds.add(w.external_id);
    this.workouts.push(w);
    this.noteDay(w.started_at.slice(0, 10));
  }

  private addMetric(date: string, field: string, value: number): void {
    this.bump(this.metricSum, date, field, (cur) => cur + value);
    this.bump(this.metricCnt, date, field, (cur) => cur + 1);
  }

  private setMetric(date: string, field: string, value: number): void {
    this.bump(this.metricSum, date, field, () => value);
    this.bump(this.metricCnt, date, field, () => 1);
  }

  private bump(
    map: Map<string, Map<string, number>>,
    date: string,
    field: string,
    fn: (cur: number) => number
  ): void {
    let inner = map.get(date);
    if (!inner) {
      inner = new Map();
      map.set(date, inner);
    }
    inner.set(field, fn(inner.get(field) ?? 0));
  }

  private buildMetrics(): AppleDailyMetric[] {
    const days = new Set<string>([
      ...this.metricSum.keys(),
      ...this.sleep.keys(),
      ...this.basal.keys(),
    ]);
    const out: AppleDailyMetric[] = [];
    for (const date of days) {
      const row: AppleDailyMetric = { date };
      const sums = this.metricSum.get(date);
      const cnts = this.metricCnt.get(date);
      if (sums) {
        for (const [field, sum] of sums) {
          const value = AVG_FIELDS.has(field) ? sum / (cnts?.get(field) ?? 1) : sum;
          (row as unknown as Record<string, number>)[field] = round(field, value);
        }
      }
      const basal = this.basal.get(date);
      if (basal != null) {
        const active = (row as unknown as Record<string, number>).active_calories ?? 0;
        row.total_calories = Math.round(active + basal);
      }
      const s = this.sleep.get(date);
      if (s) {
        if (s.asleep > 0) {
          row.sleep_duration_min = Math.round(s.asleep);
          if (s.deep > 0) row.deep_sleep_min = Math.round(s.deep);
          if (s.rem > 0) row.rem_sleep_min = Math.round(s.rem);
          if (s.light > 0) row.light_sleep_min = Math.round(s.light);
          if (s.inBed > 0)
            row.sleep_efficiency = Math.min(100, Math.round((s.asleep / s.inBed) * 100));
        } else if (s.inBed > 0) {
          row.sleep_duration_min = Math.round(s.inBed);
        }
      }
      if (Object.keys(row).length > 1) out.push(row);
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildSamples(): { samples: AppleDailySample[]; truncated: boolean } {
    let entries = [...this.samples.entries()].map(([key, s]) => {
      const sep = key.indexOf(" ");
      return {
        date: key.slice(0, sep),
        type: key.slice(sep + 1),
        unit: s.unit,
        sum: round2(s.sum),
        avg: round2(s.sum / s.count),
        min: round2(s.min),
        max: round2(s.max),
        count: s.count,
      } satisfies AppleDailySample;
    });
    let truncated = false;
    if (entries.length > MAX_DAILY_SAMPLES) {
      entries.sort((a, b) => b.date.localeCompare(a.date));
      entries = entries.slice(0, MAX_DAILY_SAMPLES);
      truncated = true;
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
    return { samples: entries, truncated };
  }

  result(): AppleHealthParseResult {
    const { samples, truncated } = this.buildSamples();
    return {
      metrics: this.buildMetrics(),
      workouts: this.workouts,
      samples,
      rangeStart: this.minDay,
      rangeEnd: this.maxDay,
      recordCount: this.recordCount,
      truncatedSamples: truncated,
    };
  }
}
