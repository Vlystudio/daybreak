"use client";

import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent } from "@/components/ui/card";
import { EventEditor } from "@/components/schedule/event-editor";
import type { ScheduleEvent } from "@/lib/types";

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

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.starts_at),
        end: new Date(e.ends_at),
        allDay: e.all_day,
        resource: e,
      })),
    [events]
  );

  function onSelectSlot(slot: SlotInfo) {
    setEditing(null);
    setDefaultDate(slot.start);
    setEditorOpen(true);
  }

  function onSelectEvent(event: CalendarEvent) {
    // Only the owner can edit; household events from others are view-only.
    if (event.resource.user_id !== currentUserId) return;
    setEditing(event.resource);
    setEditorOpen(true);
  }

  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="h-[70vh] min-h-[520px]">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={["month", "week", "day", "agenda"]}
            selectable
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            popup
            scrollToTime={new Date(1970, 0, 1, 7)}
            eventPropGetter={(event: CalendarEvent) => ({
              style: {
                backgroundColor: colorMap[event.resource.color ?? "honey"],
                opacity: event.resource.user_id === currentUserId ? 1 : 0.65,
              },
            })}
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
