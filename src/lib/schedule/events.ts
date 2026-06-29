import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import type { EventColor, ScheduleEvent } from "@/lib/types";

/**
 * Pure, framework-free helpers for the Schedule screen: date math, grouping
 * events by day, formatting human-readable labels, and laying out overlapping
 * events into side-by-side columns for the day timeline. Kept free of React and
 * server code so it can be unit-tested directly.
 */

export const WEEK_OPTS = { weekStartsOn: 1 } as const; // weeks start on Monday

// ── Date helpers ─────────────────────────────────────────────────────────────

export function dayStart(d: Date): Date {
  return startOfDay(d);
}

export function weekStartOf(d: Date): Date {
  return startOfWeek(d, WEEK_OPTS);
}

export function shiftDays(d: Date, n: number): Date {
  return addDays(d, n);
}

/** The seven dates (Mon→Sun) of the week containing `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Local calendar-day key, e.g. "2026-06-29". */
export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function sameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

// ── Event accessors ──────────────────────────────────────────────────────────

export function eventStart(e: ScheduleEvent): Date {
  return new Date(e.starts_at);
}

export function eventEnd(e: ScheduleEvent): Date {
  return new Date(e.ends_at);
}

export function isDone(e: ScheduleEvent): boolean {
  return e.completed_at != null;
}

/** A short provenance chip label, or null for plain personal events. */
export function sourceLabel(source: ScheduleEvent["source"]): string | null {
  if (source === "google") return "Google";
  if (source === "plan") return "Daybreak plan";
  return null;
}

// ── Colors ───────────────────────────────────────────────────────────────────

/** The CSS variable for an event's accent color (falls back to honey). */
export function eventColorValue(color: EventColor | null): string {
  return `var(--${color ?? "honey"})`;
}

/**
 * A calm, theme-aware tinted background derived from the accent color. Uses
 * color-mix so it reads correctly in both light and dark mode without needing a
 * dedicated `-soft` token per color.
 */
export function eventTint(color: EventColor | null, strength = 14): string {
  return `color-mix(in oklab, var(--${color ?? "honey"}) ${strength}%, var(--card))`;
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatTime(d: Date): string {
  return format(d, "h:mm a"); // "8:30 AM"
}

export function formatHour(hour: number): string {
  return format(new Date(2000, 0, 1, hour), "h a"); // "7 AM", "12 PM"
}

/** "8:30 – 9:30 AM" (shared meridiem) or "11:30 AM – 1:00 PM". */
export function formatTimeRange(start: Date, end: Date): string {
  const sameMeridiem = format(start, "a") === format(end, "a");
  const left = sameMeridiem ? format(start, "h:mm") : format(start, "h:mm a");
  return `${left} – ${format(end, "h:mm a")}`;
}

export function relativeDayLabel(date: Date, now: Date): string | null {
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, addDays(now, 1))) return "Tomorrow";
  if (isSameDay(date, addDays(now, -1))) return "Yesterday";
  return null;
}

/** "Monday, Jun 29". */
export function formatFullDay(date: Date): string {
  return format(date, "EEEE, MMM d");
}

/** "Today · Monday, Jun 29" or just "Friday, Jul 3". */
export function formatDayHeading(date: Date, now: Date): string {
  const rel = relativeDayLabel(date, now);
  return rel ? `${rel} · ${formatFullDay(date)}` : formatFullDay(date);
}

/** "Jun 29 – Jul 5". */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const left = format(weekStart, "MMM d");
  const right = format(weekEnd, sameMonth ? "d" : "MMM d");
  return `${left} – ${right}`;
}

// ── Grouping ─────────────────────────────────────────────────────────────────

export interface DayBucket {
  /** Local day key, e.g. "2026-06-29". */
  key: string;
  date: Date;
  allDay: ScheduleEvent[];
  timed: ScheduleEvent[];
  /** Total events on the day. */
  count: number;
}

function byStart(a: ScheduleEvent, b: ScheduleEvent): number {
  return (
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() ||
    new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime() ||
    a.title.localeCompare(b.title)
  );
}

/** Split a single day's events into sorted all-day and timed lists. */
export function eventsForDay(events: ScheduleEvent[], day: Date): DayBucket {
  const onDay = events.filter((e) => isSameDay(new Date(e.starts_at), day));
  const allDay = onDay.filter((e) => e.all_day).sort((a, b) => a.title.localeCompare(b.title));
  const timed = onDay.filter((e) => !e.all_day).sort(byStart);
  return { key: dayKey(day), date: day, allDay, timed, count: allDay.length + timed.length };
}

/** One bucket per supplied day, empty days included (predictable agenda). */
export function buildDayBuckets(events: ScheduleEvent[], days: Date[]): DayBucket[] {
  return days.map((day) => eventsForDay(events, day));
}

// ── Day timeline layout ──────────────────────────────────────────────────────

export interface PositionedEvent {
  event: ScheduleEvent;
  start: Date;
  end: Date;
  /** Zero-based column within its overlap cluster. */
  column: number;
  /** Total columns in its overlap cluster (for width). */
  columns: number;
}

/**
 * Assign overlapping events to side-by-side columns. Events are grouped into
 * maximal overlap clusters; within a cluster each event takes the first free
 * column, and every event in the cluster shares the cluster's column count so
 * the blocks tile evenly. Non-overlapping events stay full width.
 */
export function layoutDay(timed: ScheduleEvent[]): PositionedEvent[] {
  const items = timed
    .map((event) => ({ event, start: eventStart(event), end: eventEnd(event) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

  const out: PositionedEvent[] = [];
  let cluster: { event: ScheduleEvent; start: Date; end: Date }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const colEnds: number[] = []; // last end time per column
    const placed = cluster.map((it) => {
      let col = colEnds.findIndex((end) => end <= it.start.getTime());
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.end.getTime());
      } else {
        colEnds[col] = it.end.getTime();
      }
      return { it, col };
    });
    const columns = colEnds.length;
    for (const { it, col } of placed) {
      out.push({ event: it.event, start: it.start, end: it.end, column: col, columns });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  if (cluster.length) flush();
  return out;
}

/**
 * The hour window the day timeline should span. Defaults to a calm 7am–9pm and
 * expands only as far as the day's events actually require.
 */
export function dayGridBounds(
  timed: ScheduleEvent[],
  defaults: { startHour: number; endHour: number } = { startHour: 7, endHour: 21 }
): { startHour: number; endHour: number } {
  let startHour = defaults.startHour;
  let endHour = defaults.endHour;
  for (const e of timed) {
    const s = eventStart(e);
    const eo = eventEnd(e);
    startHour = Math.min(startHour, s.getHours());
    const endH = eo.getMinutes() > 0 || eo.getSeconds() > 0 ? eo.getHours() + 1 : eo.getHours();
    endHour = Math.max(endHour, endH);
  }
  startHour = Math.max(0, Math.min(startHour, 23));
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  return { startHour, endHour };
}
