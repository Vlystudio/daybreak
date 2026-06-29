"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeDayLabel, sameDay } from "@/lib/schedule/events";

/** A clear day section header: relative label or weekday + muted date + count. */
export function DayHeading({ date, today, count }: { date: Date; today: Date; count: number }) {
  const rel = relativeDayLabel(date, today);
  const isToday = sameDay(date, today);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="flex items-baseline gap-2 leading-none">
        <span
          className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-card-foreground")}
        >
          {rel ?? format(date, "EEEE")}
        </span>
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          {format(date, "MMM d")}
        </span>
      </h3>
      {count > 0 && (
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
          {count} {count === 1 ? "event" : "events"}
        </span>
      )}
    </div>
  );
}

/** Calm empty state for a day with no events. */
export function OpenDay({ onAdd, compact = false }: { onAdd?: () => void; compact?: boolean }) {
  return (
    <div
      className={cn(
        "border-border/60 rounded-2xl border border-dashed text-center",
        compact ? "px-3 py-4" : "px-4 py-6"
      )}
    >
      <p className="text-muted-foreground text-sm font-medium">Your day is open</p>
      {!compact && (
        <p className="text-muted-foreground mt-0.5 text-xs">
          Add something, or let Daybreak plan your day.
        </p>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add event
        </button>
      )}
    </div>
  );
}
