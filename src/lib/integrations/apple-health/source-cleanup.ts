export interface ObservationKey {
  date_local: string;
  metric: string;
}

const LEGACY_COLUMN_BY_METRIC: Record<string, string> = {
  hrv: "hrv_avg",
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

/** Null only legacy merged values that no remaining provider can support. */
export function buildLegacyAppleCleanupPatches(
  removedApple: ObservationKey[],
  remaining: ObservationKey[]
): Map<string, Record<string, null>> {
  const stillOwned = new Set(remaining.map((row) => `${row.date_local}:${row.metric}`));
  const patches = new Map<string, Record<string, null>>();
  for (const row of removedApple) {
    if (stillOwned.has(`${row.date_local}:${row.metric}`)) continue;
    const column = LEGACY_COLUMN_BY_METRIC[row.metric];
    if (!column) continue;
    const patch = patches.get(row.date_local) ?? {};
    patch[column] = null;
    patches.set(row.date_local, patch);
  }
  return patches;
}
