import { describe, it, expect } from "vitest";
import {
  appleChunkToObservations,
  attributionForSource,
  bodyMeasurementToObservations,
  dailyMetricsToObservations,
  dedupeObservations,
  legacyObservationsToBackfillRows,
  mergeObservationSources,
  normalizeObservationDate,
  subjectiveCheckinToObservations,
  toHealthObservationInput,
} from "./observation-mappers";
import { fuseDailySignals } from "./fusion";
import type { DailyMetrics } from "../integrations/oura";
import type {
  HealthMetricName,
  HealthSource,
  NewHealthObservation,
  RawHealthObservation,
} from "./types";

/** Build a full Oura DailyMetrics with nulls, overriding a few fields. */
function ouraDay(date: string, fields: Partial<DailyMetrics>): DailyMetrics {
  return {
    date,
    readiness_score: null,
    sleep_score: null,
    hrv_avg: null,
    resting_hr: null,
    sleep_duration_min: null,
    sleep_efficiency: null,
    deep_sleep_min: null,
    rem_sleep_min: null,
    light_sleep_min: null,
    activity_balance: null,
    body_temperature_delta: null,
    bedtime_start: null,
    bedtime_end: null,
    steps: null,
    active_calories: null,
    total_calories: null,
    activity_score: null,
    spo2_avg: null,
    respiratory_rate: null,
    stress_high_min: null,
    recovery_high_min: null,
    resilience_level: null,
    ...fields,
  };
}

function toRaw(o: NewHealthObservation): RawHealthObservation {
  return {
    userId: o.userId,
    date: o.dateLocal,
    metric: o.metric as HealthMetricName,
    source: o.source,
    value: o.valueNumeric ?? null,
  };
}

function raw(
  metric: HealthMetricName,
  source: HealthSource,
  value: number,
  date = "2026-06-01"
): RawHealthObservation {
  return { userId: "u1", date, metric, source, value };
}

describe("toHealthObservationInput — value routing & units", () => {
  it("routes a number to valueNumeric and defaults the policy unit", () => {
    const o = toHealthObservationInput({
      userId: "u1",
      source: "oura",
      metric: "hrv",
      date: "2026-06-01",
      value: 60,
    });
    expect(o.valueNumeric).toBe(60);
    expect(o.valueText).toBeNull();
    expect(o.unit).toBe("ms");
    expect(o.dateLocal).toBe("2026-06-01");
  });

  it("routes a non-empty string to valueText", () => {
    const o = toHealthObservationInput({
      userId: "u1",
      source: "manual",
      metric: "notes",
      date: "2026-06-01",
      value: "felt great",
    });
    expect(o.valueNumeric).toBeNull();
    expect(o.valueText).toBe("felt great");
  });
});

describe("normalizeObservationDate", () => {
  it("passes through a bare local date", () => {
    expect(normalizeObservationDate("2026-06-01")).toBe("2026-06-01");
  });
  it("formats an ISO datetime in UTC by default", () => {
    expect(normalizeObservationDate("2026-06-01T23:30:00Z")).toBe("2026-06-01");
  });
  it("respects an explicit timezone when bucketing an instant", () => {
    // 02:30Z on the 2nd is still the 1st in Los Angeles.
    expect(normalizeObservationDate("2026-06-02T02:30:00Z", "America/Los_Angeles")).toBe(
      "2026-06-01"
    );
  });
});

describe("dedupeObservations", () => {
  it("collapses exact source_sample_id duplicates (last wins)", () => {
    const a = toHealthObservationInput({
      userId: "u1",
      source: "apple_health",
      metric: "steps",
      date: "2026-06-01",
      value: 100,
      sourceSampleId: "S1",
    });
    const b = toHealthObservationInput({
      userId: "u1",
      source: "apple_health",
      metric: "steps",
      date: "2026-06-01",
      value: 200,
      sourceSampleId: "S1",
    });
    const out = dedupeObservations([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].valueNumeric).toBe(200);
  });

  it("collapses to the per-day grain for daily aggregates without a sample id", () => {
    const a = toHealthObservationInput({
      userId: "u1",
      source: "oura",
      metric: "hrv",
      date: "2026-06-01",
      value: 55,
    });
    const b = toHealthObservationInput({
      userId: "u1",
      source: "oura",
      metric: "hrv",
      date: "2026-06-01",
      value: 60,
    });
    const out = dedupeObservations([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].valueNumeric).toBe(60);
  });

  it("keeps different sources of the same metric/day as distinct rows", () => {
    const oura = toHealthObservationInput({
      userId: "u1",
      source: "oura",
      metric: "hrv",
      date: "2026-06-01",
      value: 60,
    });
    const apple = toHealthObservationInput({
      userId: "u1",
      source: "apple_health",
      metric: "hrv",
      date: "2026-06-01",
      value: 40,
    });
    const out = dedupeObservations([oura, apple]);
    expect(out).toHaveLength(2);
  });
});

describe("dailyMetricsToObservations (Oura/Fitbit)", () => {
  it("maps wearable fields to canonical metrics, tagged with the source", () => {
    const obs = dailyMetricsToObservations(
      "u1",
      [ouraDay("2026-06-01", { hrv_avg: 62, resting_hr: 54, steps: 8000 })],
      "oura"
    );
    const byMetric = new Map(obs.map((o) => [o.metric, o]));
    expect(byMetric.get("hrv")?.valueNumeric).toBe(62);
    expect(byMetric.get("hrv")?.source).toBe("oura");
    expect(byMetric.get("resting_hr")?.valueNumeric).toBe(54);
    expect(byMetric.get("steps")?.valueNumeric).toBe(8000);
  });

  it("uses the source argument so Fitbit rows are tagged fitbit", () => {
    const obs = dailyMetricsToObservations(
      "u1",
      [ouraDay("2026-06-01", { hrv_avg: 50 })],
      "fitbit"
    );
    expect(obs[0].source).toBe("fitbit");
  });
});

describe("appleChunkToObservations", () => {
  it("maps Apple daily metrics to apple_health observations", () => {
    const obs = appleChunkToObservations("u1", {
      metrics: [{ date: "2026-06-01", hrv_avg: 40, steps: 9000 }],
    });
    const byMetric = new Map(obs.map((o) => [o.metric, o]));
    expect(byMetric.get("hrv")?.source).toBe("apple_health");
    expect(byMetric.get("hrv")?.valueNumeric).toBe(40);
    expect(byMetric.get("steps")?.valueNumeric).toBe(9000);
  });

  it("counts workouts per local day", () => {
    const obs = appleChunkToObservations("u1", {
      workouts: [{ started_at: "2026-06-01T08:00:00Z" }, { started_at: "2026-06-01T18:00:00Z" }],
    });
    const workouts = obs.find((o) => o.metric === "workouts");
    expect(workouts?.valueNumeric).toBe(2);
  });
});

describe("Oura and Apple HRV stay separate (never averaged)", () => {
  it("produces two distinct HRV observations that fuse without averaging", () => {
    const oura = dailyMetricsToObservations("u1", [ouraDay("2026-06-01", { hrv_avg: 60 })], "oura");
    const apple = appleChunkToObservations("u1", {
      metrics: [{ date: "2026-06-01", hrv_avg: 40 }],
    });

    const ouraHrv = oura.find((o) => o.metric === "hrv");
    const appleHrv = apple.find((o) => o.metric === "hrv");
    expect(ouraHrv?.source).toBe("oura");
    expect(appleHrv?.source).toBe("apple_health");

    const [signal] = fuseDailySignals([toRaw(ouraHrv!), toRaw(appleHrv!)], {
      connectedSources: ["oura", "apple_health"],
    });
    expect(signal.metric).toBe("hrv");
    expect(signal.primarySource).toBe("oura");
    expect(signal.value).toBe(60); // not the 50 average
    expect(signal.sourceValues).toMatchObject({ oura: 60, apple_health: 40 });
  });
});

describe("manual self-reports → observations", () => {
  it("maps a subjective check-in to mood/energy/stress/soreness + note", () => {
    const obs = subjectiveCheckinToObservations("u1", {
      date: "2026-06-01",
      mood: 4,
      energy: 3,
      stress: 2,
      soreness: 1,
      note: "ran 5k",
    });
    const byMetric = new Map(obs.map((o) => [o.metric, o]));
    expect(byMetric.get("mood")?.valueNumeric).toBe(4);
    expect(byMetric.get("mood")?.source).toBe("manual");
    expect(byMetric.get("notes")?.valueText).toBe("ran 5k");
  });

  it("skips null subjective fields and an empty note", () => {
    const obs = subjectiveCheckinToObservations("u1", {
      date: "2026-06-01",
      mood: 4,
      energy: null,
      stress: null,
      soreness: null,
    });
    expect(obs.map((o) => o.metric)).toEqual(["mood"]);
  });

  it("maps a body measurement to weight/body fat", () => {
    const obs = bodyMeasurementToObservations("u1", {
      date: "2026-06-01",
      weight_kg: 80,
      body_fat_pct: 18,
    });
    const byMetric = new Map(obs.map((o) => [o.metric, o]));
    expect(byMetric.get("weight_kg")?.valueNumeric).toBe(80);
    expect(byMetric.get("body_fat_pct")?.valueNumeric).toBe(18);
  });
});

describe("mergeObservationSources — observations-first, legacy fallback", () => {
  it("prefers the exact observation and drops the legacy row for the same date/metric/source", () => {
    const primary = [raw("hrv", "oura", 60)];
    const legacy = [raw("hrv", "oura", 55), raw("steps", "apple_health", 9000)];
    const { observations, usedLegacy } = mergeObservationSources(primary, legacy);
    expect(observations).toHaveLength(2);
    expect(observations.find((o) => o.metric === "hrv")?.value).toBe(60); // exact, not legacy 55
    expect(usedLegacy).toBe(true); // steps came from legacy
  });

  it("does not flag legacy use when observations already cover everything", () => {
    const primary = [raw("hrv", "oura", 60), raw("steps", "apple_health", 9000)];
    const legacy = [raw("hrv", "oura", 55)];
    const { observations, usedLegacy } = mergeObservationSources(primary, legacy);
    expect(observations).toHaveLength(2);
    expect(usedLegacy).toBe(false);
  });

  it("falls back entirely to legacy when there are no observations yet", () => {
    const { observations, usedLegacy } = mergeObservationSources([], [raw("hrv", "oura", 55)]);
    expect(observations).toHaveLength(1);
    expect(usedLegacy).toBe(true);
  });
});

describe("source_sample_id dedup is scoped by user and source", () => {
  function sample(
    userId: string,
    source: HealthSource,
    sampleId: string,
    value: number
  ): NewHealthObservation {
    return toHealthObservationInput({
      userId,
      source,
      metric: "steps",
      date: "2026-06-01",
      value,
      sourceSampleId: sampleId,
    });
  }

  it("same sample id from different USERS does not collapse", () => {
    const out = dedupeObservations([
      sample("u1", "apple_health", "S1", 100),
      sample("u2", "apple_health", "S1", 200),
    ]);
    expect(out).toHaveLength(2);
  });

  it("same sample id from different SOURCES does not collapse", () => {
    const out = dedupeObservations([
      sample("u1", "apple_health", "S1", 100),
      sample("u1", "fitbit", "S1", 200),
    ]);
    expect(out).toHaveLength(2);
  });

  it("same sample id for the same user+source collapses (last wins)", () => {
    const out = dedupeObservations([
      sample("u1", "apple_health", "S1", 100),
      sample("u1", "apple_health", "S1", 200),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].valueNumeric).toBe(200);
  });
});

describe("daily aggregate rows are idempotent", () => {
  it("re-deriving the same Oura day collapses to one row per metric (re-sync safe)", () => {
    const day = ouraDay("2026-06-01", { hrv_avg: 60, resting_hr: 54, steps: 8000 });
    const first = dailyMetricsToObservations("u1", [day], "oura");
    const second = dailyMetricsToObservations("u1", [day], "oura");
    const combined = dedupeObservations([...first, ...second]);
    expect(combined).toHaveLength(first.length);
  });
});

describe("aggregation grain", () => {
  it("defaults to daily for wearable/apple rows", () => {
    const oura = dailyMetricsToObservations("u1", [ouraDay("2026-06-01", { hrv_avg: 60 })], "oura");
    expect(oura[0].aggregationType).toBe("daily");
    const apple = appleChunkToObservations("u1", {
      metrics: [{ date: "2026-06-01", steps: 9000 }],
    });
    expect(apple[0].aggregationType).toBe("daily");
  });

  it("tags manual self-reports as manual_entry", () => {
    const checkin = subjectiveCheckinToObservations("u1", {
      date: "2026-06-01",
      mood: 4,
      energy: null,
      stress: null,
      soreness: null,
      note: "ok",
    });
    expect(checkin.every((o) => o.aggregationType === "manual_entry")).toBe(true);
    const body = bodyMeasurementToObservations("u1", {
      date: "2026-06-01",
      weight_kg: 80,
      body_fat_pct: null,
    });
    expect(body[0].aggregationType).toBe("manual_entry");
  });
});

describe("units are explicit and consistent", () => {
  it("uses canonical units for the metrics the user cares about", () => {
    const u = (metric: Parameters<typeof toHealthObservationInput>[0]["metric"]) =>
      toHealthObservationInput({
        userId: "u1",
        source: "oura",
        metric,
        date: "2026-06-01",
        value: 1,
      }).unit;
    expect(u("hrv")).toBe("ms");
    expect(u("sleep_duration_min")).toBe("min");
    expect(u("steps")).toBe("count");
    expect(u("workouts")).toBe("count");
    expect(u("active_calories")).toBe("kcal");
    expect(u("weight_kg")).toBe("kg");
  });
});

describe("text vs numeric values", () => {
  it("notes use value_text and never value_numeric", () => {
    const obs = subjectiveCheckinToObservations("u1", {
      date: "2026-06-01",
      mood: null,
      energy: null,
      stress: null,
      soreness: null,
      note: "slept badly",
    });
    const note = obs.find((o) => o.metric === "notes");
    expect(note?.valueText).toBe("slept badly");
    expect(note?.valueNumeric).toBeNull();
  });

  it("symptoms (free text) route to value_text without breaking numeric assumptions", () => {
    const o = toHealthObservationInput({
      userId: "u1",
      source: "manual",
      metric: "symptoms",
      date: "2026-06-01",
      value: "headache",
    });
    expect(o.valueText).toBe("headache");
    expect(o.valueNumeric).toBeNull();
  });
});

describe("Apple source attribution (documented limitation)", () => {
  it("defaults daily-aggregated Apple data to apple_health, not apple_watch", () => {
    const obs = appleChunkToObservations("u1", { metrics: [{ date: "2026-06-01", steps: 9000 }] });
    expect(obs.every((o) => o.source === "apple_health")).toBe(true);
  });

  it("lets a caller that knows the device override to apple_watch", () => {
    const obs = appleChunkToObservations(
      "u1",
      { metrics: [{ date: "2026-06-01", steps: 9000 }] },
      "apple_watch"
    );
    expect(obs.every((o) => o.source === "apple_watch")).toBe(true);
  });
});

describe("backfill builder — attribution & tagging (pure)", () => {
  it("classifies Apple + manual as exact and wearable-from-merged as legacy_best_effort", () => {
    expect(attributionForSource("apple_health")).toBe("exact");
    expect(attributionForSource("apple_watch")).toBe("exact");
    expect(attributionForSource("manual")).toBe("exact");
    expect(attributionForSource("oura")).toBe("legacy_best_effort");
    expect(attributionForSource("fitbit")).toBe("legacy_best_effort");
  });

  it("tags rows with backfilled + source_attribution and counts by attribution", () => {
    const legacy = [
      raw("hrv", "oura", 55),
      raw("steps", "apple_health", 9000),
      raw("mood", "manual", 4),
    ];
    const { rows, byAttribution, bySource } = legacyObservationsToBackfillRows("u1", legacy);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.metadata?.backfilled).toBe(true);
      expect(r.metadata?.source_attribution).toBeDefined();
    }
    expect(byAttribution).toEqual({ exact: 2, legacy_best_effort: 1 });
    expect(bySource).toEqual({ oura: 1, apple_health: 1, manual: 1 });
    // Manual backfill rows match the live grain.
    expect(rows.find((r) => r.source === "manual")?.aggregationType).toBe("manual_entry");
  });

  it("skips non-numeric legacy values", () => {
    const legacy: RawHealthObservation[] = [
      { userId: "u1", date: "2026-06-01", metric: "hrv", source: "oura", value: null },
    ];
    const { rows } = legacyObservationsToBackfillRows("u1", legacy);
    expect(rows).toHaveLength(0);
  });
});
