import type { Goal, GoalProgress } from "@/lib/types";

/**
 * Pure goal-progress computation. Works for both directions (losing or gaining)
 * by measuring how far `current` has moved from `start` toward `target`. Weight
 * is stored in kg and converted to lb for display; body fat is a percentage.
 */

const KG_PER_LB = 0.45359237;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function toDisplay(metric: Goal["metric"], canonical: number): number {
  return metric === "weight" ? Math.round((canonical / KG_PER_LB) * 10) / 10 : Math.round(canonical * 10) / 10;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export function computeGoalProgress(goal: Goal, currentCanonical: number | null, today: string): GoalProgress {
  const current = currentCanonical ?? goal.start_value;
  const span = goal.start_value - goal.target_value; // signed distance to cover
  const progressed = goal.start_value - current;
  const pctComplete = span !== 0 ? clamp01(progressed / span) : current === goal.target_value ? 1 : 0;

  // Did we reach the target? (cross it in the intended direction)
  const reached =
    span > 0 ? current <= goal.target_value : span < 0 ? current >= goal.target_value : current === goal.target_value;

  let expectedPct: number | null = null;
  let daysLeft: number | null = null;
  let onTrack: boolean | null = null;
  if (goal.target_date) {
    const totalDays = daysBetween(goal.start_date, goal.target_date);
    const elapsed = daysBetween(goal.start_date, today);
    daysLeft = daysBetween(today, goal.target_date);
    if (totalDays > 0) {
      expectedPct = clamp01(elapsed / totalDays);
      onTrack = pctComplete + 0.05 >= expectedPct; // small tolerance
    }
  }

  return {
    id: goal.id,
    metric: goal.metric,
    unit: goal.metric === "weight" ? "lb" : "%",
    startDisplay: toDisplay(goal.metric, goal.start_value),
    targetDisplay: toDisplay(goal.metric, goal.target_value),
    currentDisplay: toDisplay(goal.metric, current),
    pctComplete,
    expectedPct,
    daysLeft,
    status: reached ? "achieved" : goal.status,
    onTrack,
    reached,
  };
}

export { KG_PER_LB };
