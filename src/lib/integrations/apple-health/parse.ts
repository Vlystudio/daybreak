import { Unzip, UnzipInflate } from "fflate";
import type { AppleHealthParseResult, AppleWorkout } from "./types";
import { DailyAggregator, toKcal, toMeters, workoutExternalId } from "./aggregate";

/**
 * Streams an Apple Health "Export All Health Data" zip in the *browser* and
 * aggregates it (via the shared DailyAggregator) to daily metrics, workouts, and
 * a per-day long tail — so only compact JSON crosses to the server, never the
 * raw multi-hundred-MB XML.
 *
 * Why client-side: HealthKit has no server API, the export.xml routinely runs to
 * hundreds of MB (over a Server Action's body limit and a serverless function's
 * memory/time budget), and aggregating here keeps raw health data off every
 * intermediate hop. The zip is decompressed and scanned as a stream (fflate +
 * a tag scanner with a leftover buffer across chunks) so memory stays bounded.
 */

// ── Date helpers (Apple writes device-local time with an explicit offset) ────

/** "2024-03-15 07:23:45 -0700" → epoch ms. */
function appleDateToMs(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/);
  if (m) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}:${m[8]}`);
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

/** The local calendar day is the leading 10 chars (offset already applied). */
function localDay(s: string): string {
  return s.slice(0, 10);
}

const ATTR_RE = /(\w+)="([^"]*)"/g;
function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(tag)) !== null) out[m[1]] = m[2];
  return out;
}

/**
 * Scans Apple Health XML as it streams in, extracting complete opening tags
 * across chunk boundaries (Apple keeps all values in attributes) and feeding the
 * shared aggregator. Workouts are containers, so it tracks the open workout and
 * folds nested <WorkoutStatistics> into it.
 */
class HealthXmlScanner {
  private buf = "";
  private current: AppleWorkout | null = null;

  constructor(private agg: DailyAggregator) {}

  write(text: string): void {
    this.buf += text;
    this.scan();
  }

  end(): void {
    this.scan();
    this.finishWorkout();
    this.buf = "";
  }

  private scan(): void {
    let i = 0;
    for (;;) {
      const lt = this.buf.indexOf("<", i);
      if (lt === -1) {
        this.buf = "";
        return;
      }
      const gt = this.buf.indexOf(">", lt + 1);
      if (gt === -1) {
        this.buf = this.buf.slice(lt);
        return;
      }
      this.handleTag(this.buf.slice(lt, gt + 1));
      i = gt + 1;
    }
  }

  private handleTag(tag: string): void {
    if (tag.startsWith("<Record ")) this.handleRecord(parseAttrs(tag));
    else if (tag.startsWith("<Workout ")) this.handleWorkout(parseAttrs(tag), tag.endsWith("/>"));
    else if (tag.startsWith("<WorkoutStatistics ")) this.handleWorkoutStat(parseAttrs(tag));
    else if (tag.startsWith("</Workout>")) this.finishWorkout();
    else if (tag.startsWith("<ActivitySummary ")) this.handleActivitySummary(parseAttrs(tag));
  }

  private handleRecord(a: Record<string, string>): void {
    const type = a.type;
    if (!type || !a.startDate) return;

    if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
      if (!a.endDate) return;
      const startMs = appleDateToMs(a.startDate);
      const endMs = appleDateToMs(a.endDate);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
      this.agg.addSleepSegment(localDay(a.endDate), a.value, (endMs - startMs) / 60000);
      return;
    }

    const value = parseFloat(a.value);
    if (!Number.isFinite(value)) return;
    this.agg.addQuantity(type, value, a.unit ?? "", localDay(a.startDate));
  }

  private handleWorkout(a: Record<string, string>, selfClosing: boolean): void {
    if (!a.startDate) return;
    const startMs = appleDateToMs(a.startDate);
    const endMs = a.endDate ? appleDateToMs(a.endDate) : NaN;
    const activity = (a.workoutActivityType ?? "").replace(/^HKWorkoutActivityType/, "") || "Other";

    const w: AppleWorkout = {
      external_id: "", // set below from normalized fields
      activity_type: activity,
      started_at: Number.isFinite(startMs) ? new Date(startMs).toISOString() : a.startDate,
      ended_at: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
      duration_sec: a.duration ? Math.round(parseFloat(a.duration) * 60) : null,
      distance_m: a.totalDistance
        ? toMeters(parseFloat(a.totalDistance), a.totalDistanceUnit ?? "")
        : null,
      active_energy_kcal: a.totalEnergyBurned
        ? toKcal(parseFloat(a.totalEnergyBurned), a.totalEnergyBurnedUnit ?? "")
        : null,
      total_energy_kcal: null,
      avg_hr: null,
      max_hr: null,
      metadata: a.sourceName ? { sourceName: a.sourceName } : {},
    };
    w.external_id = workoutExternalId(activity, w.started_at, w.duration_sec);

    if (selfClosing) this.agg.addWorkout(w);
    else this.current = w;
  }

  private handleWorkoutStat(a: Record<string, string>): void {
    const w = this.current;
    if (!w || !a.type) return;
    const unit = a.unit ?? "";
    const num = (k: string) => (a[k] !== undefined ? parseFloat(a[k]) : NaN);
    if (a.type === "HKQuantityTypeIdentifierActiveEnergyBurned" && Number.isFinite(num("sum"))) {
      w.active_energy_kcal = toKcal(num("sum"), unit);
    } else if (
      a.type === "HKQuantityTypeIdentifierBasalEnergyBurned" &&
      Number.isFinite(num("sum"))
    ) {
      w.total_energy_kcal = (w.active_energy_kcal ?? 0) + toKcal(num("sum"), unit);
    } else if (
      a.type.startsWith("HKQuantityTypeIdentifierDistance") &&
      Number.isFinite(num("sum"))
    ) {
      w.distance_m = toMeters(num("sum"), unit);
    } else if (a.type === "HKQuantityTypeIdentifierHeartRate") {
      if (Number.isFinite(num("average"))) w.avg_hr = num("average");
      if (Number.isFinite(num("maximum"))) w.max_hr = num("maximum");
    }
  }

  private finishWorkout(): void {
    if (this.current) {
      this.agg.addWorkout(this.current);
      this.current = null;
    }
  }

  private handleActivitySummary(a: Record<string, string>): void {
    const day = a.dateComponents;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    this.agg.setActivityRings(
      day,
      a.appleExerciseTime ? parseFloat(a.appleExerciseTime) : undefined,
      a.appleStandHours ? parseFloat(a.appleStandHours) : undefined
    );
  }
}

/**
 * Parse an Apple Health export zip (browser File) into aggregated import data.
 * `onProgress` reports read progress 0–1 (decompression/scan happen inline).
 */
export async function parseAppleHealthExport(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<AppleHealthParseResult> {
  const agg = new DailyAggregator();
  const scanner = new HealthXmlScanner(agg);
  const decoder = new TextDecoder();
  let foundXml = false;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (entry) => {
    // The export contains apple_health_export/export.xml (and export_cda.xml,
    // which we must skip). Match the bare export.xml only.
    if (!/(^|\/)export\.xml$/.test(entry.name)) return;
    foundXml = true;
    entry.ondata = (err, chunk, final) => {
      if (err) throw err;
      scanner.write(decoder.decode(chunk, { stream: !final }));
      if (final) scanner.end();
    };
    entry.start();
  };

  const reader = file.stream().getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    unzip.push(value, false);
    read += value.length;
    if (file.size > 0) onProgress?.(Math.min(0.99, read / file.size));
  }
  onProgress?.(1);

  if (!foundXml) {
    throw new Error(
      "That zip doesn't contain export.xml — make sure you uploaded the file from Health → Export All Health Data."
    );
  }
  return agg.result();
}
