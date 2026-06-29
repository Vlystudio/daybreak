"use client";

import { Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  eventColorValue,
  eventEnd,
  eventStart,
  eventTint,
  formatTime,
  formatTimeRange,
  isDone,
  sourceLabel,
} from "@/lib/schedule/events";
import type { ScheduleEvent } from "@/lib/types";

/**
 * A polished, readable schedule event card. Used by the Agenda and Week views.
 * - `onSelect` makes the card tappable to edit; omit it for read-only events
 *   (e.g. a household member's events).
 * - `onToggleDone` shows a completion checkbox; omit for read-only events.
 * - `compact` tightens spacing for dense week columns.
 */
export function EventCard({
  event,
  onSelect,
  onToggleDone,
  compact = false,
}: {
  event: ScheduleEvent;
  onSelect?: (event: ScheduleEvent) => void;
  onToggleDone?: (event: ScheduleEvent) => void;
  compact?: boolean;
}) {
  const done = isDone(event);
  const start = eventStart(event);
  const end = eventEnd(event);
  const accent = eventColorValue(event.color);
  const src = sourceLabel(event.source);
  const timeLabel = event.all_day
    ? "All day"
    : compact
      ? formatTime(start)
      : formatTimeRange(start, end);

  const ariaLabel = [
    timeLabel,
    event.title,
    event.location || null,
    src ? `from ${src}` : null,
    done ? "done" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const interactive = Boolean(onSelect);

  return (
    <div
      className={cn(
        "border-border/55 shadow-soft relative flex items-start gap-3 rounded-2xl border",
        compact ? "p-2.5" : "p-3",
        done && "opacity-60"
      )}
      style={{ backgroundColor: eventTint(event.color, done ? 7 : 14) }}
    >
      <span
        aria-hidden
        className="mt-0.5 w-1.5 shrink-0 self-stretch rounded-full"
        style={{ background: accent, minHeight: compact ? "1.75rem" : "2.25rem" }}
      />

      <button
        type="button"
        onClick={interactive ? () => onSelect?.(event) : undefined}
        aria-label={ariaLabel}
        disabled={!interactive}
        className={cn(
          "focus-visible:ring-ring min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none",
          interactive ? "cursor-pointer" : "cursor-default"
        )}
      >
        <p
          className={cn(
            "text-card-foreground line-clamp-2 leading-snug font-semibold",
            compact ? "text-sm" : "text-[0.95rem]",
            done && "line-through"
          )}
        >
          {event.title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs font-medium tabular-nums">{timeLabel}</p>
        {(event.location || src) && (
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {event.location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{event.location}</span>
              </span>
            )}
            {src && (
              <span className="border-border/70 rounded-full border px-1.5 py-0.5 font-medium">
                {src}
              </span>
            )}
          </div>
        )}
      </button>

      {onToggleDone && (
        <button
          type="button"
          onClick={() => onToggleDone(event)}
          aria-pressed={done}
          aria-label={done ? `Mark ${event.title} as not done` : `Mark ${event.title} as done`}
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "bg-sage border-transparent text-white"
              : "border-muted-foreground/40 hover:border-sage focus-visible:border-sage text-transparent"
          )}
        >
          <Check className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
