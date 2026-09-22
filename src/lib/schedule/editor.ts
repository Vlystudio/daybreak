import { addDays, format, parseISO, startOfDay, isSameDay } from "date-fns";
import type { ScheduleEvent } from "@/lib/types";

export function eventInputDate(iso: string, allDay = false): string {
  return format(parseISO(iso), allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
}

/** Older imports sometimes used 23:59 instead of an exclusive midnight end. */
export function eventLastDay(iso: string): string {
  const end = parseISO(iso);
  return format(end.getTime() === startOfDay(end).getTime() ? addDays(end, -1) : end, "yyyy-MM-dd");
}

/** Date-only inputs are local calendar dates, never UTC midnight. */
export function eventInputRange(start: string, end: string, allDay: boolean) {
  const startsAt = parseISO(start);
  const endsAt = allDay ? addDays(startOfDay(parseISO(end)), 1) : parseISO(end);
  return { startsAt, endsAt };
}

export function suggestedEventStart(date: Date, now = new Date()): Date {
  const start = new Date(
    isSameDay(date, now) ? Math.max(date.getTime(), now.getTime()) : date.getTime()
  );
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  if (isSameDay(date, now) && start <= now) start.setMinutes(start.getMinutes() + 15);
  return start;
}

/** Half-open intervals: adjacent events do not conflict. Ignore the edited event. */
export function conflictingEvents(events: ScheduleEvent[], start: Date, end: Date, id?: string) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    return [];
  return events.filter(
    (event) =>
      event.id !== id &&
      !event.all_day &&
      parseISO(event.starts_at) < end &&
      parseISO(event.ends_at) > start
  );
}
