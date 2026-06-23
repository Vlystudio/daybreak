import { Flame, Sprout, Star } from "lucide-react";

/** Compact hero strip: Daybreak level + XP bar, seeds, and day streak. */
export function StatsStrip({
  level,
  intoLevel,
  span,
  seeds,
  dayStreak,
}: {
  level: number;
  intoLevel: number;
  span: number;
  seeds: number;
  dayStreak: number;
}) {
  const pct = span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 shadow-soft backdrop-blur sm:gap-5">
      {/* Level */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Star className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">Level {level}</span>
            <span className="tabular-nums text-muted-foreground">
              {intoLevel}/{span} XP
            </span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Seeds */}
      <div className="flex items-center gap-1.5 border-l border-border/60 pl-3 sm:pl-5">
        <Sprout className="h-4 w-4 text-sage" aria-hidden />
        <span className="text-sm font-semibold tabular-nums">{seeds}</span>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-1.5">
        <Flame className={dayStreak > 0 ? "h-4 w-4 text-honey" : "h-4 w-4 text-muted-foreground"} aria-hidden />
        <span className="text-sm font-semibold tabular-nums">{dayStreak}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">day{dayStreak === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
