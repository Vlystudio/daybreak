import { describe, expect, it } from "vitest";
import {
  conflictingEvents,
  eventInputDate,
  eventInputRange,
  eventLastDay,
  suggestedEventStart,
} from "./editor";
import type { ScheduleEvent } from "@/lib/types";

describe("event editing dates", () => {
  it("stores a one-day all-day event as local midnight to the next midnight", () => {
    const range = eventInputRange("2026-09-22", "2026-09-22", true);
    expect(range.startsAt).toEqual(new Date(2026, 8, 22));
    expect(range.endsAt).toEqual(new Date(2026, 8, 23));
  });
  it("keeps multi-day ranges inclusive in the form and exclusive in storage", () => {
    const range = eventInputRange("2026-03-07", "2026-03-09", true);
    expect(range.endsAt).toEqual(new Date(2026, 2, 10));
    expect(eventInputDate(range.startsAt.toISOString(), true)).toBe("2026-03-07");
  });
  it("preserves exact times for timed events", () => {
    const range = eventInputRange("2026-09-22T14:15", "2026-09-22T15:45", false);
    expect(range.startsAt).toEqual(new Date(2026, 8, 22, 14, 15));
    expect(eventInputDate(range.endsAt.toISOString())).toBe("2026-09-22T15:45");
  });
  it("displays both exclusive midnight and legacy end-of-day imports correctly", () => {
    expect(eventLastDay(new Date(2026, 8, 23).toISOString())).toBe("2026-09-22");
    expect(eventLastDay(new Date(2026, 8, 22, 23, 59).toISOString())).toBe("2026-09-22");
  });
  it("rounds new events forward, including the next day at midnight", () => {
    const now = new Date(2026, 8, 22, 23, 57);
    expect(suggestedEventStart(now, now)).toEqual(new Date(2026, 8, 23));
  });
  it("does not replace a deliberately selected historical date with today", () => {
    expect(suggestedEventStart(new Date(2026, 8, 20, 9), new Date(2026, 8, 22, 12))).toEqual(
      new Date(2026, 8, 20, 9)
    );
  });
});

describe("event overlap guidance", () => {
  const events = [
    {
      id: "first",
      starts_at: "2026-09-22T09:00:00Z",
      ends_at: "2026-09-22T10:00:00Z",
      all_day: false,
    },
    {
      id: "second",
      starts_at: "2026-09-22T09:30:00Z",
      ends_at: "2026-09-22T11:00:00Z",
      all_day: false,
    },
    {
      id: "holiday",
      starts_at: "2026-09-22T00:00:00Z",
      ends_at: "2026-09-23T00:00:00Z",
      all_day: true,
    },
  ] as ScheduleEvent[];
  it("ignores adjacent blocks, all-day labels, and the event being edited", () => {
    expect(
      conflictingEvents(
        events,
        new Date("2026-09-22T10:00:00Z"),
        new Date("2026-09-22T12:00:00Z"),
        "second"
      )
    ).toEqual([]);
  });
  it("finds containing and partially overlapping blocks", () => {
    expect(
      conflictingEvents(
        events,
        new Date("2026-09-22T09:45:00Z"),
        new Date("2026-09-22T10:30:00Z")
      ).map((e) => e.id)
    ).toEqual(["first", "second"]);
  });
  it("does not show misleading warnings for incomplete or reversed dates", () => {
    expect(conflictingEvents(events, new Date(""), new Date())).toEqual([]);
    expect(conflictingEvents(events, new Date("2026-09-23"), new Date("2026-09-22"))).toEqual([]);
  });
});
