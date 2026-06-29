import { Flame, Sprout, Star } from "lucide-react";
import { NEST_ENABLED } from "@/lib/features";

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
    <div className="border-border/60 bg-card/70 shadow-soft flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 backdrop-blur sm:gap-5">
      {/* Level */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="bg-primary/15 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Star className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">Level {level}</span>
            <span className="text-muted-foreground tabular-nums">
              {intoLevel}/{span} XP
            </span>
          </p>
          <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Seeds — hidden while the Nest game is disabled (see @/lib/features). */}
      {NEST_ENABLED && (
        <div className="border-border/60 flex items-center gap-1.5 border-l pl-3 sm:pl-5">
          <Sprout className="text-sage h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold tabular-nums">{seeds}</span>
        </div>
      )}

      {/* Streak */}
      <div className="flex items-center gap-1.5">
        <Flame
          className={dayStreak > 0 ? "text-honey h-4 w-4" : "text-muted-foreground h-4 w-4"}
          aria-hidden
        />
        <span className="text-sm font-semibold tabular-nums">{dayStreak}</span>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          day{dayStreak === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
