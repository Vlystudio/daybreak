"use client";

import { EventCard } from "@/components/schedule/event-card";
import {
  dayGridBounds,
  eventColorValue,
  eventTint,
  formatHour,
  formatTime,
  formatTimeRange,
  isDone,
  layoutDay,
  sameDay,
  type DayBucket,
  type PositionedEvent,
} from "@/lib/schedule/events";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "@/lib/types";

const HOUR_PX = 60;
const MIN_BLOCK_PX = 40;
const GUTTER = "3.5rem"; // 56px: time labels + their padding

/** A single-day vertical timeline. Events span their time; short events stay
 * readable via a minimum height and compact rendering. Tapping an empty hour
 * starts a new event there. */
export function DayView({
  day,
  bucket,
  today,
  canEdit,
  onSelect,
  onToggleDone,
  onCreate,
}: {
  day: Date;
  bucket: DayBucket;
  today: Date;
  canEdit: (event: ScheduleEvent) => boolean;
  onSelect: (event: ScheduleEvent) => void;
  onToggleDone: (event: ScheduleEvent) => void;
  onCreate: (date: Date) => void;
}) {
  const { startHour, endHour } = dayGridBounds(bucket.timed);
  const positioned = layoutDay(bucket.timed);
  const totalHours = endHour - startHour;
  const gridHeight = totalHours * HOUR_PX;
  const hourMarks = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() - startHour * 60;
  const showNow = sameDay(day, today) && nowMinutes >= 0 && nowMinutes <= totalHours * 60;

  function createAtHour(hour: number) {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onCreate(d);
  }

  return (
    <div>
      {bucket.allDay.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            All day
          </p>
          {bucket.allDay.map((event) => {
            const editable = canEdit(event);
            return (
              <EventCard
                key={event.id}
                event={event}
                compact
                onSelect={editable ? onSelect : undefined}
                onToggleDone={editable ? onToggleDone : undefined}
              />
            );
          })}
        </div>
      )}

      <div className="border-border/55 bg-card shadow-soft rounded-2xl border p-2">
        <div className="relative" style={{ height: gridHeight }}>
          {/* Hour lines + labels */}
          {hourMarks.map((hour) => (
            <div
              key={hour}
              className="pointer-events-none absolute inset-x-0 flex items-center"
              style={{ top: (hour - startHour) * HOUR_PX }}
            >
              <span
                className="text-muted-foreground -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums"
                style={{ width: GUTTER }}
              >
                {hour < 24 ? formatHour(hour) : ""}
              </span>
              <span className="bg-border/40 h-px flex-1" />
            </div>
          ))}

          {/* Event area (right of the time gutter) */}
          <div className="absolute inset-y-0 right-1" style={{ left: GUTTER }}>
            {/* Tappable empty hours, behind the event blocks */}
            {Array.from({ length: totalHours }, (_, i) => startHour + i).map((hour, i) => (
              <button
                key={hour}
                type="button"
                onClick={() => createAtHour(hour)}
                aria-label={`Add event at ${formatHour(hour)}`}
                className="focus-visible:ring-ring absolute inset-x-0 rounded-md focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
              />
            ))}

            {positioned.map((p) => (
              <DayBlock
                key={p.event.id}
                positioned={p}
                startHour={startHour}
                editable={canEdit(p.event)}
                onSelect={onSelect}
              />
            ))}

            {showNow && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-20"
                style={{ top: (nowMinutes / 60) * HOUR_PX }}
              >
                <span
                  className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                <span className="block h-0.5 w-full" style={{ background: "var(--primary)" }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayBlock({
  positioned,
  startHour,
  editable,
  onSelect,
}: {
  positioned: PositionedEvent;
  startHour: number;
  editable: boolean;
  onSelect: (event: ScheduleEvent) => void;
}) {
  const { event, start, end, column, columns } = positioned;
  const top = ((start.getHours() * 60 + start.getMinutes() - startHour * 60) / 60) * HOUR_PX;
  const rawHeight = ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX;
  const height = Math.max(MIN_BLOCK_PX, rawHeight);
  const widthPct = 100 / columns;
  const done = isDone(event);
  const tight = height < 56;
  const timeLabel = formatTimeRange(start, end);

  return (
    <button
      type="button"
      onClick={editable ? () => onSelect(event) : undefined}
      disabled={!editable}
      aria-label={[timeLabel, event.title, done ? "done" : null].filter(Boolean).join(", ")}
      className={cn(
        "shadow-soft focus-visible:ring-ring absolute z-10 overflow-hidden rounded-xl border px-2 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        editable ? "cursor-pointer" : "cursor-default",
        done && "opacity-60"
      )}
      style={{
        top,
        height: height - 4,
        left: `calc(${column * widthPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: eventTint(event.color, done ? 10 : 20),
        borderColor: `color-mix(in oklab, ${eventColorValue(event.color)} 45%, transparent)`,
      }}
    >
      {tight ? (
        <p
          className={cn(
            "text-card-foreground truncate text-xs font-semibold",
            done && "line-through"
          )}
        >
          <span className="text-muted-foreground font-medium tabular-nums">
            {formatTime(start)}
          </span>{" "}
          {event.title}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground truncate text-[11px] font-medium tabular-nums">
            {timeLabel}
          </p>
          <p
            className={cn(
              "text-card-foreground line-clamp-2 text-sm leading-snug font-semibold",
              done && "line-through"
            )}
          >
            {event.title}
          </p>
        </>
      )}
    </button>
  );
}
