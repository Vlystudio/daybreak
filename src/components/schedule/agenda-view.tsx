"use client";

import { EventCard } from "@/components/schedule/event-card";
import { DayHeading, OpenDay } from "@/components/schedule/parts";
import type { DayBucket } from "@/lib/schedule/events";
import type { ScheduleEvent } from "@/lib/types";

/**
 * Agenda: the week grouped into readable day sections. The default mobile view —
 * a calm vertical scroll where every event title is legible at a glance.
 */
export function AgendaView({
  buckets,
  today,
  canEdit,
  onSelect,
  onToggleDone,
  onAdd,
}: {
  buckets: DayBucket[];
  today: Date;
  canEdit: (event: ScheduleEvent) => boolean;
  onSelect: (event: ScheduleEvent) => void;
  onToggleDone: (event: ScheduleEvent) => void;
  onAdd: (date: Date) => void;
}) {
  return (
    <div className="space-y-6">
      {buckets.map((bucket) => {
        const events = [...bucket.allDay, ...bucket.timed];
        return (
          <section key={bucket.key} aria-label={`Events on ${bucket.date.toDateString()}`}>
            <DayHeading date={bucket.date} today={today} count={bucket.count} />
            <div className="mt-2.5 space-y-2">
              {events.length === 0 ? (
                <OpenDay onAdd={() => onAdd(bucket.date)} />
              ) : (
                events.map((event) => {
                  const editable = canEdit(event);
                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={editable ? onSelect : undefined}
                      onToggleDone={editable ? onToggleDone : undefined}
                    />
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
