"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AgendaView } from "@/components/schedule/agenda-view";
import { DayView } from "@/components/schedule/day-view";
import { WeekView } from "@/components/schedule/week-view";
import { EventEditor } from "@/components/schedule/event-editor";
import { toggleEventCompleted } from "@/actions/schedule";
import {
  buildDayBuckets,
  dayKey,
  dayStart,
  eventsForDay,
  formatFullDay,
  formatWeekRange,
  relativeDayLabel,
  sameDay,
  shiftDays,
  weekDays,
  weekStartOf,
} from "@/lib/schedule/events";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "@/lib/types";

type ViewKey = "agenda" | "day" | "week";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
];

const LEGEND: { color: string; label: string }[] = [
  { color: "var(--honey)", label: "Meals & focus" },
  { color: "var(--sage)", label: "Workouts & recovery" },
  { color: "var(--peach)", label: "Chores & errands" },
  { color: "var(--sky)", label: "Google Calendar" },
];

export function ScheduleView({
  events,
  currentUserId,
  hasHousehold,
}: {
  events: ScheduleEvent[];
  currentUserId: string;
  hasHousehold: boolean;
}) {
  const today = useMemo(() => dayStart(new Date()), []);

  const [view, setView] = useState<ViewKey>("agenda");
  const [anchor, setAnchor] = useState<Date>(today);
  const [weekSel, setWeekSel] = useState<string>(dayKey(today));

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date>(new Date());
  const [, startTransition] = useTransition();

  // Local copy so completion toggles feel instant; resync when server data changes.
  const [items, setItems] = useState<ScheduleEvent[]>(events);
  const [prevEvents, setPrevEvents] = useState(events);
  if (events !== prevEvents) {
    setPrevEvents(events);
    setItems(events);
  }

  const weekStart = useMemo(() => weekStartOf(anchor), [anchor]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const buckets = useMemo(() => buildDayBuckets(items, days), [items, days]);
  const dayBucket = useMemo(
    () => buckets.find((b) => b.key === dayKey(anchor)) ?? eventsForDay(items, anchor),
    [buckets, items, anchor]
  );

  // Keep the week's selected day valid as the week changes.
  const selectedKey = days.some((d) => dayKey(d) === weekSel)
    ? weekSel
    : days.some((d) => sameDay(d, today))
      ? dayKey(today)
      : dayKey(days[0]);

  const canEdit = (event: ScheduleEvent) => event.user_id === currentUserId;

  function openCreate(date: Date) {
    setEditing(null);
    setDefaultDate(date);
    setEditorOpen(true);
  }

  function openEdit(event: ScheduleEvent) {
    setEditing(event);
    setEditorOpen(true);
  }

  function headerCreate() {
    const d = new Date(anchor);
    if (sameDay(anchor, today)) {
      d.setHours(new Date().getHours() + 1, 0, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    openCreate(d);
  }

  function toggleDone(event: ScheduleEvent) {
    const done = event.completed_at != null;
    const nextCompleted = done ? null : new Date().toISOString();
    setItems((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, completed_at: nextCompleted } : e))
    );
    startTransition(async () => {
      const res = await toggleEventCompleted(event.id, !done);
      if (!res.ok) {
        setItems(events);
        toast.error(res.error);
      }
    });
  }

  const unit = view === "day" ? "day" : "week";
  function navigate(delta: number) {
    setAnchor((a) => shiftDays(a, view === "day" ? delta : delta * 7));
  }
  function goToday() {
    setAnchor(today);
    setWeekSel(dayKey(today));
  }

  const rangeLabel = view === "day" ? formatFullDay(anchor) : formatWeekRange(weekStart);
  const dayRel = view === "day" ? relativeDayLabel(anchor, today) : null;

  return (
    <div className="space-y-4">
      {/* Header: title + add */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Schedule</h1>
        <button
          type="button"
          onClick={headerCreate}
          className="bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </button>
      </div>

      {/* Date range + navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-card-foreground truncate text-base font-semibold">{rangeLabel}</p>
          {dayRel && (
            <span className="bg-primary/15 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
              {dayRel}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={goToday}
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={`Previous ${unit}`}
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label={`Next ${unit}`}
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div
        role="tablist"
        aria-label="Schedule view"
        className="border-border/55 bg-card grid grid-cols-3 gap-1 rounded-2xl border p-1"
      >
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.key)}
              className={cn(
                "focus-visible:ring-ring min-h-9 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "bg-primary/15 text-primary shadow-soft"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* The active view */}
      <div>
        {view === "agenda" && (
          <AgendaView
            buckets={buckets}
            today={today}
            canEdit={canEdit}
            onSelect={openEdit}
            onToggleDone={toggleDone}
            onAdd={openCreate}
          />
        )}
        {view === "day" && (
          <DayView
            day={anchor}
            bucket={dayBucket}
            today={today}
            canEdit={canEdit}
            onSelect={openEdit}
            onToggleDone={toggleDone}
            onCreate={openCreate}
          />
        )}
        {view === "week" && (
          <WeekView
            buckets={buckets}
            today={today}
            selectedKey={selectedKey}
            onSelectDay={setWeekSel}
            canEdit={canEdit}
            onSelect={openEdit}
            onToggleDone={toggleDone}
            onCreate={openCreate}
          />
        )}
      </div>

      {/* Color key — tucked away to keep the screen calm */}
      <details className="group border-border/55 bg-card/60 rounded-xl border px-3.5 py-2.5">
        <summary className="text-muted-foreground cursor-pointer list-none text-xs font-medium marker:hidden">
          Color key
        </summary>
        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: l.color }}
                aria-hidden
              />
              {l.label}
            </span>
          ))}
          <span className="opacity-70">Faded = done</span>
        </div>
      </details>

      <EventEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={editing}
        defaultDate={defaultDate}
        hasHousehold={hasHousehold}
      />
    </div>
  );
}
