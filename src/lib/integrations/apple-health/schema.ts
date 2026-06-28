import { z } from "zod";
import { APPLE_METRIC_FIELDS } from "./types";

/**
 * Zod schemas for Apple Health import payloads. Shared by the Phase 1 export
 * upload (Server Action) and the Phase 2 native HealthKit ingest route, so both
 * entry points validate identically. Pure (no server-only imports).
 */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finiteNum = z.number().finite();

// A date plus any subset of the Apple-populated health_metrics columns.
// `.strict()` rejects unexpected keys so a typo can't reach a column name.
const metricShape: Record<string, z.ZodTypeAny> = { date: dateStr };
for (const field of APPLE_METRIC_FIELDS) metricShape[field] = finiteNum.optional();
export const metricSchema = z.object(metricShape).strict();

// .nullish() (null | undefined | value) on optional metrics so an omitted field
// from the native plugin doesn't fail validation.
export const workoutSchema = z.object({
  external_id: z.string().min(1).max(64),
  activity_type: z.string().min(1).max(64),
  started_at: z.string().min(1).max(40),
  ended_at: z.string().max(40).nullish(),
  duration_sec: z.number().int().nonnegative().nullish(),
  distance_m: finiteNum.nonnegative().nullish(),
  active_energy_kcal: finiteNum.nonnegative().nullish(),
  total_energy_kcal: finiteNum.nonnegative().nullish(),
  avg_hr: finiteNum.nonnegative().nullish(),
  max_hr: finiteNum.nonnegative().nullish(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const sampleSchema = z.object({
  date: dateStr,
  type: z.string().min(1).max(128),
  unit: z.string().max(32).nullable(),
  sum: finiteNum,
  avg: finiteNum,
  min: finiteNum,
  max: finiteNum,
  count: z.number().int().nonnegative(),
});

export const chunkSchema = z.object({
  metrics: z.array(metricSchema).max(5000).optional(),
  workouts: z.array(workoutSchema).max(5000).optional(),
  samples: z.array(sampleSchema).max(5000).optional(),
});

export const summarySchema = z.object({
  fileName: z.string().max(256).optional(),
  source: z.enum(["file", "healthkit"]).default("file"),
  rangeStart: dateStr.nullable(),
  rangeEnd: dateStr.nullable(),
  metricsDays: z.number().int().nonnegative(),
  workouts: z.number().int().nonnegative(),
  samples: z.number().int().nonnegative(),
});

export type AppleHealthChunk = z.input<typeof chunkSchema>;
export type ImportSummary = z.input<typeof summarySchema>;
export type ChunkResult =
  | { ok: true; metrics: number; workouts: number; samples: number }
  | { ok: false; error: string };
