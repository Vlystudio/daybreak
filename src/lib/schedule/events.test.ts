import { describe, expect, it } from "vitest";
import type { ScheduleEvent } from "@/lib/types";
import {
  buildDayBuckets,
  dayGridBounds,
  eventsForDay,
  formatTimeRange,
  formatWeekRange,
  layoutDay,
  relativeDayLabel,
  sourceLabel,
  weekDays,
  weekStartOf,
} from "./events";

/** Build a ScheduleEvent from local Date parts so tests are timezone-stable. */
function ev(
  id: string,
  start: Date,
  end: Date,
  overrides: Partial<ScheduleEvent> = {}
): ScheduleEvent {
  return {
    id,
    user_id: "user-1",
    household_id: null,
    title: id,
    description: null,
    location: null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: false,
    source: "manual",
    color: "honey",
    completed_at: null,
    plan_type: null,
    workout_id: null,
    recipe: null,
    ...overrides,
  };
}

const at = (h: number, m = 0) => new Date(2026, 5, 29, h, m); // Mon Jun 29 2026, local

describe("eventsForDay", () => {
  it("separates all-day from timed and sorts timed by start", () => {
    const events = [
      ev("lunch", at(12), at(13)),
      ev("standup", at(9), at(9, 30)),
      ev("holiday", at(0), at(23, 59), { all_day: true, title: "Holiday" }),
    ];
    const bucket = eventsForDay(events, at(10));
    expect(bucket.allDay.map((e) => e.id)).toEqual(["holiday"]);
    expect(bucket.timed.map((e) => e.id)).toEqual(["standup", "lunch"]);
    expect(bucket.count).toBe(3);
  });

  it("ignores events on other days", () => {
    const events = [
      ev("today", at(9), at(10)),
      ev("tomorrow", new Date(2026, 5, 30, 9), new Date(2026, 5, 30, 10)),
    ];
    expect(eventsForDay(events, at(8)).timed.map((e) => e.id)).toEqual(["today"]);
  });

  it("preserves long titles verbatim (truncation is presentational only)", () => {
    const long = "Quarterly planning workshop with the extended product and design team";
    const bucket = eventsForDay([ev("x", at(9), at(10), { title: long })], at(9));
    expect(bucket.timed[0].title).toBe(long);
  });
});

describe("buildDayBuckets", () => {
  it("returns one bucket per day including empty days", () => {
    const week = weekDays(weekStartOf(at(12)));
    const buckets = buildDayBuckets([ev("only", at(9), at(10))], week);
    expect(buckets).toHaveLength(7);
    const withEvents = buckets.filter((b) => b.count > 0);
    expect(withEvents).toHaveLength(1);
    expect(buckets.filter((b) => b.count === 0)).toHaveLength(6);
  });
});

describe("layoutDay", () => {
  it("gives non-overlapping events a single full-width column", () => {
    const out = layoutDay([ev("a", at(9), at(10)), ev("b", at(11), at(12))]);
    expect(out.every((p) => p.columns === 1 && p.column === 0)).toBe(true);
  });

  it("splits two overlapping events into two columns", () => {
    const out = layoutDay([ev("a", at(9), at(10, 30)), ev("b", at(10), at(11))]);
    const a = out.find((p) => p.event.id === "a")!;
    const b = out.find((p) => p.event.id === "b")!;
    expect(a.columns).toBe(2);
    expect(b.columns).toBe(2);
    expect(a.column).toBe(0);
    expect(b.column).toBe(1);
  });

  it("resets column count between separate clusters", () => {
    const out = layoutDay([
      ev("a", at(9), at(10, 30)),
      ev("b", at(10), at(11)),
      ev("c", at(14), at(15)), // separate cluster
    ]);
    expect(out.find((p) => p.event.id === "c")!.columns).toBe(1);
  });
});

describe("dayGridBounds", () => {
  it("defaults to a calm 7am–9pm window", () => {
    expect(dayGridBounds([])).toEqual({ startHour: 7, endHour: 21 });
  });

  it("expands to fit early and late events", () => {
    const bounds = dayGridBounds([ev("early", at(6), at(7)), ev("late", at(20), at(22, 30))]);
    expect(bounds.startHour).toBe(6);
    expect(bounds.endHour).toBe(23); // 22:30 rounds up to 23
  });
});

describe("formatTimeRange", () => {
  it("shares the meridiem when both ends are in the same half-day", () => {
    expect(formatTimeRange(at(8, 30), at(9, 30))).toBe("8:30 – 9:30 AM");
  });

  it("shows both meridiems when crossing noon", () => {
    expect(formatTimeRange(at(11, 30), at(13))).toBe("11:30 AM – 1:00 PM");
  });
});

describe("formatWeekRange", () => {
  it("formats a within-month week", () => {
    expect(formatWeekRange(new Date(2026, 5, 8))).toBe("Jun 8 – 14");
  });

  it("formats a cross-month week", () => {
    expect(formatWeekRange(new Date(2026, 5, 29))).toBe("Jun 29 – Jul 5");
  });
});

describe("relativeDayLabel", () => {
  const now = at(10);
  it("labels today, tomorrow, and yesterday", () => {
    expect(relativeDayLabel(at(23), now)).toBe("Today");
    expect(relativeDayLabel(new Date(2026, 5, 30), now)).toBe("Tomorrow");
    expect(relativeDayLabel(new Date(2026, 5, 28), now)).toBe("Yesterday");
  });
  it("returns null for other days", () => {
    expect(relativeDayLabel(new Date(2026, 6, 2), now)).toBeNull();
  });
});

describe("weekStartOf / weekDays", () => {
  it("starts the week on Monday and yields seven days", () => {
    const start = weekStartOf(at(12));
    expect(start.getDay()).toBe(1); // Monday
    const days = weekDays(start);
    expect(days).toHaveLength(7);
    expect(days.some((d) => d.getDate() === 29 && d.getMonth() === 5)).toBe(true);
  });
});

describe("sourceLabel", () => {
  it("labels external sources and hides manual", () => {
    expect(sourceLabel("google")).toBe("Google");
    expect(sourceLabel("plan")).toBe("Daybreak plan");
    expect(sourceLabel("manual")).toBeNull();
  });
});
