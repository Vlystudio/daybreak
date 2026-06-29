import "server-only";
import { buildDailyHealthUnderstanding } from "./understanding";
import { snapshotFromUnderstanding, type PlanHealthSnapshot } from "./plan-input";

/**
 * Server-only entry point: run the source-aware understanding layer and reduce
 * it to the normalized plan snapshot. Kept separate from the pure
 * `snapshotFromUnderstanding` (in `./plan-input`) so that — and its tests —
 * never pull in the admin client.
 */
export async function buildPlanHealthSnapshot(
  userId: string,
  from: Date = new Date(Date.now() - 14 * 86_400_000),
  to: Date = new Date()
): Promise<PlanHealthSnapshot> {
  const understanding = await buildDailyHealthUnderstanding(userId, from, to);
  return snapshotFromUnderstanding(understanding);
}
