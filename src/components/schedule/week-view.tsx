"use client";

import { format } from "date-fns";
import { EventCard } from "@/components/schedule/event-card";
import { DayHeading, OpenDay } from "@/components/schedule/parts";
import { sameDay, type DayBucket } from "@/lib/schedule/events";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "@/lib/types";

/**
 * Week, made mobile-friendly. Phones/tablets get a horizontal day selector and
 * the chosen day's events listed below (no cramped hour grid). Large screens get
 * a readable seven-column board where every title stays legible.
 */
export function WeekView({
  buckets,
  today,
  selectedKey,
  onSelectDay,
  canEdit,
  onSelect,
  onToggleDone,
  onCreate,
}: {
  buckets: DayBucket[];
  today: Date;
  selectedKey: string;
  onSelectDay: (key: string) => void;
  canEdit: (event: ScheduleEvent) => boolean;
  onSelect: (event: ScheduleEvent) => void;
  onToggleDone: (event: ScheduleEvent) => void;
  onCreate: (date: Date) => void;
}) {
  const selected = buckets.find((b) => b.key === selectedKey) ?? buckets[0];

  function renderCard(event: ScheduleEvent, compact = false) {
    const editable = canEdit(event);
    return (
      <EventCard
        key={event.id}
        event={event}
        compact={compact}
        onSelect={editable ? onSelect : undefined}
        onToggleDone={editable ? onToggleDone : undefined}
      />
    );
  }

  return (
    <div>
      {/* Mobile / tablet: day selector + selected day */}
      <div className="lg:hidden">
        <WeekStrip
          buckets={buckets}
          today={today}
          selectedKey={selected.key}
          onSelectDay={onSelectDay}
        />
        <div className="mt-5">
          <DayHeading date={selected.date} today={today} count={selected.count} />
          <div className="mt-2.5 space-y-2">
            {selected.count === 0 ? (
              <OpenDay onAdd={() => onCreate(selected.date)} />
            ) : (
              [...selected.allDay, ...selected.timed].map((event) => renderCard(event))
            )}
          </div>
        </div>
      </div>

      {/* Desktop: readable seven-column board */}
      <div className="hidden grid-cols-7 gap-3 lg:grid">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="min-w-0">
            <ColumnHeader date={bucket.date} today={today} count={bucket.count} />
            <div className="mt-2 space-y-2">
              {bucket.count === 0 ? (
                <OpenDay compact onAdd={() => onCreate(bucket.date)} />
              ) : (
                [...bucket.allDay, ...bucket.timed].map((event) => renderCard(event, true))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekStrip({
  buckets,
  today,
  selectedKey,
  onSelectDay,
}: {
  buckets: DayBucket[];
  today: Date;
  selectedKey: string;
  onSelectDay: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="Select a day">
      {buckets.map((bucket) => {
        const isSelected = bucket.key === selectedKey;
        const isToday = sameDay(bucket.date, today);
        return (
          <button
            key={bucket.key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${format(bucket.date, "EEEE, MMM d")}, ${bucket.count} ${
              bucket.count === 1 ? "event" : "events"
            }`}
            onClick={() => onSelectDay(bucket.key)}
            className={cn(
              "focus-visible:ring-ring flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
              isSelected
                ? "border-primary/40 bg-primary/15 text-primary"
                : cn("border-border/55 hover:bg-accent", isToday && "ring-primary/40 ring-1")
            )}
          >
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              {format(bucket.date, "EEE")}
            </span>
            <span
              className={cn(
                "text-base font-semibold tabular-nums",
                isSelected ? "text-primary" : isToday ? "text-primary" : "text-card-foreground"
              )}
            >
              {format(bucket.date, "d")}
            </span>
            <span aria-hidden className="flex h-1.5 items-center">
              {bucket.count > 0 && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary" : "bg-muted-foreground/50"
                  )}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ColumnHeader({ date, today, count }: { date: Date; today: Date; count: number }) {
  const isToday = sameDay(date, today);
  return (
    <div className="border-border/55 flex items-baseline justify-between gap-1 border-b pb-1.5">
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            isToday ? "text-primary" : "text-muted-foreground"
          )}
        >
          {format(date, "EEE")}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isToday ? "text-primary" : "text-card-foreground"
          )}
        >
          {format(date, "d")}
        </span>
      </span>
      {count > 0 && <span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>}
    </div>
  );
}
