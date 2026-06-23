import type { Habit, HabitStatus } from "@/lib/types";

/**
 * Pure habit-status computation, shared by the dashboard loader (and easy to
 * unit test). Given a habit's completed dates (YYYY-MM-DD) and the local "today",
 * derive whether it's done today, the current consecutive-day streak, and how
 * many of the last 7 days it was done.
 */

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function computeHabitStatus(habit: Habit, completedDates: Iterable<string>, today: string): HabitStatus {
  const done = new Set(completedDates);
  const doneToday = done.has(today);

  // Streak: consecutive days ending at today (or yesterday if today isn't done
  // yet, so an unchecked morning doesn't read as a broken streak).
  let streak = 0;
  let cursor = doneToday ? today : shiftDate(today, -1);
  while (done.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }

  let weekCount = 0;
  for (let i = 0; i < 7; i++) {
    if (done.has(shiftDate(today, -i))) weekCount++;
  }

  return {
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    color: habit.color,
    sort_order: habit.sort_order,
    target_per_week: habit.target_per_week,
    doneToday,
    streak,
    weekCount,
  };
}
