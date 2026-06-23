import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * User-level progression: a Daybreak Level that grows with total seeds earned,
 * plus a day-streak (consecutive local days you did something that earned
 * seeds). Derived from user_game + reward_ledger — no new tables.
 */

export interface LevelInfo {
  level: number;
  intoLevel: number; // seeds earned within the current level
  span: number; // seeds needed to clear the current level
}

/** A gentle quadratic curve: level L is reached at 30·(L-1)² total seeds. */
export function levelFromSeeds(total: number): LevelInfo {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, total) / 30)) + 1);
  const base = 30 * Math.pow(level - 1, 2);
  const next = 30 * Math.pow(level, 2);
  return { level, intoLevel: Math.round(total - base), span: Math.round(next - base) };
}

export interface UserProgress {
  seeds: number;
  totalEarned: number;
  level: number;
  intoLevel: number;
  span: number;
  dayStreak: number;
  activeToday: boolean;
}

function localDate(timeZone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export async function loadUserProgress(userId: string, timeZone: string): Promise<UserProgress> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 80 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: game }, { data: ledger }] = await Promise.all([
    admin.from("user_game").select("seeds, total_earned").eq("user_id", userId).maybeSingle<{ seeds: number; total_earned: number }>(),
    admin.from("reward_ledger").select("awarded_on").eq("user_id", userId).gte("awarded_on", since).returns<{ awarded_on: string }[]>(),
  ]);

  const totalEarned = game?.total_earned ?? 0;
  const { level, intoLevel, span } = levelFromSeeds(totalEarned);

  // Day streak: consecutive local days with at least one reward, ending today
  // (or yesterday, so a fresh morning doesn't read as broken).
  const activeDays = new Set((ledger ?? []).map((r) => r.awarded_on));
  const today = localDate(timeZone, 0);
  const activeToday = activeDays.has(today);
  let dayStreak = 0;
  const cursor = activeToday ? 0 : -1;
  // Walk back day by day while each day is active.
  for (let i = 0; i < 400; i++) {
    const d = localDate(timeZone, cursor - i);
    if (activeDays.has(d)) dayStreak++;
    else break;
  }

  return { seeds: game?.seeds ?? 0, totalEarned, level, intoLevel, span, dayStreak, activeToday };
}
