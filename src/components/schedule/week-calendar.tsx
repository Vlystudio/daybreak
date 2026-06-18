"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { Card, CardContent } from "@/components/ui/card";
import { EventEditor } from "@/components/schedule/event-editor";
import { updateScheduleEvent } from "@/actions/schedule";
import type { ScheduleEvent } from "@/lib/types";
import type { ScheduleEventInput } from "@/lib/validation";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: ScheduleEvent;
}

const colorMap: Record<string, string> = {
  honey: "var(--honey)",
  sage: "var(--sage)",
  sky: "var(--sky)",
  peach: "var(--peach)",
};

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

export function WeekCalendar({
  events,
  currentUserId,
  hasHousehold,
}: {
  events: ScheduleEvent[];
  currentUserId: string;
  hasHousehold: boolean;
}) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState(new Date());
  const [, startTransition] = useTransition();

  // Local copy so drags reflect immediately; resync when server data changes.
  const [items, setItems] = useState<ScheduleEvent[]>(events);
  useEffect(() => setItems(events), [events]);

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      items.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.starts_at),
        end: new Date(e.ends_at),
        allDay: e.all_day,
        resource: e,
      })),
    [items]
  );

  function onSelectSlot(slot: SlotInfo) {
    setEditing(null);
    setDefaultDate(slot.start);
    setEditorOpen(true);
  }

  function onSelectEvent(event: CalendarEvent) {
    if (event.resource.user_id !== currentUserId) return; // others' household events are view-only
    setEditing(event.resource);
    setEditorOpen(true);
  }

  function persistMove(resource: ScheduleEvent, start: Date, end: Date) {
    setItems((prev) =>
      prev.map((e) =>
        e.id === resource.id ? { ...e, starts_at: start.toISOString(), ends_at: end.toISOString() } : e
      )
    );
    const input: ScheduleEventInput = {
      title: resource.title,
      description: resource.description ?? "",
      location: resource.location ?? "",
      startsAt: start,
      endsAt: end,
      allDay: resource.all_day,
      color: resource.color ?? "honey",
      shareWithHousehold: resource.household_id != null,
    };
    startTransition(async () => {
      const res = await updateScheduleEvent(resource.id, input);
      if (!res.ok) {
        setItems(events); // revert
        toast.error(res.error);
      }
    });
  }

  function canMove(e: ScheduleEvent) {
    return e.user_id === currentUserId && e.source !== "google";
  }

  function onEventDrop({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date | string;
    end: Date | string;
  }) {
    if (!canMove(event.resource)) return;
    persistMove(event.resource, new Date(start), new Date(end));
  }

  function onEventResize({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date | string;
    end: Date | string;
  }) {
    if (!canMove(event.resource)) return;
    persistMove(event.resource, new Date(start), new Date(end));
  }

  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="h-[70vh] min-h-[520px]">
          <DnDCalendar
            localizer={localizer}
            events={calendarEvents}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={["month", "week", "day", "agenda"]}
            selectable
            resizable
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            draggableAccessor={(event: CalendarEvent) => canMove(event.resource)}
            popup
            scrollToTime={new Date(1970, 0, 1, 7)}
            tooltipAccessor={(event: CalendarEvent) => event.resource.description || event.title}
            eventPropGetter={(event: CalendarEvent) => {
              const e = event.resource;
              const done = e.completed_at != null;
              return {
                style: {
                  backgroundColor: colorMap[e.color ?? "honey"],
                  opacity: done ? 0.45 : e.user_id === currentUserId ? 1 : 0.65,
                  textDecoration: done ? "line-through" : undefined,
                },
              };
            }}
          />
        </div>
      </CardContent>

      <EventEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={editing}
        defaultDate={defaultDate}
        hasHousehold={hasHousehold}
      />
    </Card>
  );
}
