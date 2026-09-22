"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useUiPreference } from "@/components/ui-preferences";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgendaView } from "@/components/schedule/agenda-view";
import { DayView } from "@/components/schedule/day-view";
import { WeekView } from "@/components/schedule/week-view";
import { EventEditor } from "@/components/schedule/event-editor";
import { useEventCompletion } from "@/components/schedule/use-event-completion";
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
  planningControls,
}: {
  events: ScheduleEvent[];
  currentUserId: string;
  hasHousehold: boolean;
  planningControls?: ReactNode;
}) {
  const today = useMemo(() => dayStart(new Date()), []);

  const [view, setView] = useUiPreference<ViewKey>("schedule-view", "agenda");
  const [anchorKey, setAnchorKey] = useUiPreference("schedule-date", dayKey(today));
  const anchor = useMemo(() => new Date(`${anchorKey}T00:00:00`), [anchorKey]);
  const setAnchor = (date: Date) => setAnchorKey(dayKey(date));
  const [weekSel, setWeekSel] = useState<string>(dayKey(today));

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date>(new Date());
  const { items, toggleDone } = useEventCompletion(events);

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

  const unit = view === "day" ? "day" : "week";
  function navigate(delta: number) {
    setAnchor(shiftDays(anchor, view === "day" ? delta : delta * 7));
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
          className="bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </button>
      </div>

      {planningControls && (
        <details className="surface-inset px-4">
          <summary className="flex min-h-12 items-center justify-between gap-2 text-sm font-medium">
            Plan your week <span className="text-muted-foreground text-xs">Optional tools</span>
          </summary>
          <div className="pb-4">{planningControls}</div>
        </details>
      )}

      {/* Date range + navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={`Previous ${unit}`}
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label={`Next ${unit}`}
            className="border-border bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as ViewKey)}>
        <TabsList className="grid w-full grid-cols-3" aria-label="Schedule view">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.key} value={v.key}>
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* The active view */}
        <TabsContent value="agenda">
          <AgendaView
            buckets={buckets}
            today={today}
            canEdit={canEdit}
            onSelect={openEdit}
            onToggleDone={toggleDone}
            onAdd={openCreate}
          />
        </TabsContent>
        <TabsContent value="day">
          <DayView
            day={anchor}
            bucket={dayBucket}
            today={today}
            canEdit={canEdit}
            onSelect={openEdit}
            onToggleDone={toggleDone}
            onCreate={openCreate}
          />
        </TabsContent>
        <TabsContent value="week">
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
        </TabsContent>
      </Tabs>

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
        existingEvents={items}
      />
    </div>
  );
}
