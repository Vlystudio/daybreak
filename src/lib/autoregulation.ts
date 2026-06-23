/**
 * Deterministic training autoregulation. Given recent readiness scores and
 * subjective soreness/stress, decide whether to deload, maintain, or push —
 * the signal the workout generator must honor over any single day's numbers.
 */

export type Directive = "deload" | "maintain" | "progress";

export interface Autoregulation {
  directive: Directive;
  reason: string;
  readinessAvg: number | null;
  sorenessAvg: number | null;
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/**
 * @param readiness recent daily readiness scores (0-100), newest first
 * @param soreness recent subjective soreness (1-5), newest first
 * @param stress recent subjective stress (1-5), newest first
 */
export function computeAutoregulation(
  readiness: (number | null)[],
  soreness: (number | null)[],
  stress: (number | null)[]
): Autoregulation {
  const r = readiness.slice(0, 3).filter((n): n is number => typeof n === "number");
  const rWeek = readiness.slice(0, 5).filter((n): n is number => typeof n === "number");
  const sore = soreness.slice(0, 3).filter((n): n is number => typeof n === "number");
  const str = stress.slice(0, 3).filter((n): n is number => typeof n === "number");

  const readinessAvg = avg(r);
  const sorenessAvg = avg(sore);
  const stressAvg = avg(str);

  // Deload: sustained low recovery, or high soreness/stress.
  if (readinessAvg != null && readinessAvg < 60) {
    return { directive: "deload", reason: `Readiness has averaged ${Math.round(readinessAvg)} over recent days — back off and recover.`, readinessAvg, sorenessAvg };
  }
  if (sorenessAvg != null && sorenessAvg >= 4) {
    return { directive: "deload", reason: "You've been reporting high soreness — ease the load and prioritize mobility.", readinessAvg, sorenessAvg };
  }
  if (stressAvg != null && stressAvg >= 4 && (readinessAvg == null || readinessAvg < 70)) {
    return { directive: "deload", reason: "High stress with middling recovery — keep it light today.", readinessAvg, sorenessAvg };
  }

  // Progress: consistently strong recovery and not sore.
  const strongWeek = avg(rWeek);
  if (
    readinessAvg != null && readinessAvg >= 75 &&
    (strongWeek == null || strongWeek >= 70) &&
    (sorenessAvg == null || sorenessAvg <= 2)
  ) {
    return { directive: "progress", reason: `Recovery has been strong (readiness ~${Math.round(readinessAvg)}) — a good window to push.`, readinessAvg, sorenessAvg };
  }

  return { directive: "maintain", reason: "Recovery is steady — keep the plan on track.", readinessAvg, sorenessAvg };
}
