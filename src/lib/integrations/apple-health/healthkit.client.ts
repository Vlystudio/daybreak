import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { DailyAggregator, MAPPED_QUANTITY_TYPES, workoutExternalId } from "./aggregate";
import type { AppleWorkout } from "./types";

/**
 * Phase 2 native HealthKit client. Runs ONLY inside the Capacitor iOS shell
 * (no-op on web). Reads on-device via the native HealthKit plugin, aggregates
 * with the same DailyAggregator the file-export path uses, and POSTs to
 * /api/ingest/apple-health using the shared Supabase session cookie.
 *
 * The native plugin pre-buckets quantity data into daily aggregates
 * (HKStatisticsCollectionQuery), so a multi-year first sync stays bounded
 * (days × types) instead of shipping millions of raw samples. Sleep and
 * workouts come back as discrete samples. See docs/apple-health-phase-2.md for
 * the Swift side and the exact return shapes.
 */

// ── Native plugin interface (implemented in Swift) ───────────────────────────

interface DailyPoint {
  date: string; // YYYY-MM-DD (device-local)
  value: number;
  unit: string;
}
interface SleepSample {
  value: string; // HKCategoryValueSleepAnalysis*
  startDate: string; // ISO
  endDate: string; // ISO
}
interface WorkoutSample {
  activityType: string; // e.g. "Running" (prefix already stripped) or raw HK name
  startDate: string; // ISO
  endDate: string | null;
  durationSec: number | null;
  distanceM: number | null;
  activeEnergyKcal: number | null;
  totalEnergyKcal: number | null;
  avgHr: number | null;
  maxHr: number | null;
}

export interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(options: { read: string[] }): Promise<{ granted: boolean }>;
  /** Daily aggregates for one quantity type over [startDate, endDate] (YYYY-MM-DD). */
  queryDailyQuantity(options: {
    type: string;
    startDate: string;
    endDate: string;
  }): Promise<{ points: DailyPoint[] }>;
  querySleep(options: { startDate: string; endDate: string }): Promise<{ samples: SleepSample[] }>;
  queryWorkouts(options: {
    startDate: string;
    endDate: string;
  }): Promise<{ workouts: WorkoutSample[] }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

// V1 requests only metrics that are visibly surfaced in Daybreak. Broad medical
// categories (glucose, blood pressure, temperature) and unused long-tail types
// are intentionally excluded even though the native bridge can query them.
export const HEALTHKIT_QUANTITY_TYPES = [...MAPPED_QUANTITY_TYPES];

export const HEALTHKIT_READ_TYPES = [
  ...HEALTHKIT_QUANTITY_TYPES,
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKWorkoutTypeIdentifier",
];

export const LAST_SYNC_KEY = "apple_health_last_sync";
export const CONNECTED_KEY = "apple_health_connected";
const CHUNK = 1500;
export type HealthImportDays = 90 | 365;

export function isNativeHealthKit(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildWorkout(w: WorkoutSample): AppleWorkout {
  const activity = w.activityType.replace(/^HKWorkoutActivityType/, "") || "Other";
  const startedAt = new Date(w.startDate).toISOString();
  return {
    external_id: workoutExternalId(activity, startedAt, w.durationSec),
    activity_type: activity,
    started_at: startedAt,
    ended_at: w.endDate ? new Date(w.endDate).toISOString() : null,
    // Coalesce undefined → null: the native plugin omits these when absent, and
    // JSON.stringify drops undefined keys, which the server schema would reject.
    duration_sec: w.durationSec ?? null,
    distance_m: w.distanceM ?? null,
    active_energy_kcal: w.activeEnergyKcal ?? null,
    total_energy_kcal: w.totalEnergyKcal ?? null,
    avg_hr: w.avgHr ?? null,
    max_hr: w.maxHr ?? null,
    metadata: {},
  };
}

async function postIngest(body: unknown): Promise<void> {
  const res = await fetch("/api/ingest/apple-health", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ingest failed (${res.status}): ${text.slice(0, 120)}`);
  }
}

function batches<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type SyncResult =
  | { ok: true; days: number; workouts: number; samples: number }
  | { ok: false; reason: "not-native" | "not-connected" | "denied" | "error"; error?: string };

export function initialHealthKitStart(end: Date, days: HealthImportDays = 90): Date {
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

export async function clearHealthKitLocalState(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: LAST_SYNC_KEY }),
    Preferences.remove({ key: CONNECTED_KEY }),
  ]);
}

/**
 * Pull new HealthKit data and push it to the server. Incremental: only fetches
 * since the last successful sync (minus a small overlap for late-arriving data),
 * unless `full` forces a complete backfill. Safe to call on every app launch.
 */
export async function syncHealthKit(
  opts: { authorize?: boolean; importDays?: HealthImportDays } = {}
): Promise<SyncResult> {
  if (!isNativeHealthKit()) return { ok: false, reason: "not-native" };

  try {
    const avail = await HealthKit.isAvailable();
    if (!avail.available) return { ok: false, reason: "error", error: "HealthKit unavailable" };

    const connected = (await Preferences.get({ key: CONNECTED_KEY })).value === "true";
    if (!connected && !opts.authorize) return { ok: false, reason: "not-connected" };

    if (opts.authorize) {
      const { granted } = await HealthKit.requestAuthorization({ read: HEALTHKIT_READ_TYPES });
      if (!granted) return { ok: false, reason: "denied" };
      await Preferences.set({ key: CONNECTED_KEY, value: "true" });
    }

    const end = new Date();
    let start: Date;
    const stored = (await Preferences.get({ key: LAST_SYNC_KEY })).value;
    if (!stored) {
      start = initialHealthKitStart(end, opts.importDays ?? 90);
    } else {
      start = new Date(stored);
      start.setDate(start.getDate() - 3); // re-pull a few days to catch late edits
    }
    const startStr = ymd(start);
    const endStr = ymd(end);

    const agg = new DailyAggregator();

    for (const type of HEALTHKIT_QUANTITY_TYPES) {
      try {
        const { points } = await HealthKit.queryDailyQuantity({
          type,
          startDate: startStr,
          endDate: endStr,
        });
        for (const p of points) agg.addQuantity(type, p.value, p.unit, p.date);
      } catch {
        // A type the user hasn't authorized or that's empty — skip, don't fail the sync.
      }
    }

    try {
      const { samples } = await HealthKit.querySleep({ startDate: startStr, endDate: endStr });
      for (const s of samples) {
        const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        if (ms > 0)
          agg.addSleepSegment(new Date(s.endDate).toISOString().slice(0, 10), s.value, ms / 60000);
      }
    } catch {
      /* no sleep auth/data */
    }

    try {
      const { workouts } = await HealthKit.queryWorkouts({ startDate: startStr, endDate: endStr });
      for (const w of workouts) agg.addWorkout(buildWorkout(w));
    } catch {
      /* no workout auth/data */
    }

    const result = agg.result();

    // Upload in chunks, then a summary marking the sync complete.
    const calls: unknown[] = [
      ...batches(result.metrics, CHUNK).map((metrics) => ({ chunk: { metrics } })),
      ...batches(result.workouts, CHUNK).map((workouts) => ({ chunk: { workouts } })),
      ...batches(result.samples, CHUNK).map((samples) => ({ chunk: { samples } })),
    ];
    for (const body of calls) await postIngest(body);

    await postIngest({
      summary: {
        rangeStart: result.rangeStart,
        rangeEnd: result.rangeEnd,
        metricsDays: result.metrics.length,
        workouts: result.workouts.length,
        samples: result.samples.length,
      },
    });

    await Preferences.set({ key: LAST_SYNC_KEY, value: end.toISOString() });
    return {
      ok: true,
      days: result.metrics.length,
      workouts: result.workouts.length,
      samples: result.samples.length,
    };
  } catch (err) {
    return { ok: false, reason: "error", error: err instanceof Error ? err.message : "unknown" };
  }
}
