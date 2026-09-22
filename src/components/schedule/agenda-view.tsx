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
  const includesToday = buckets.some((b) => b.date.toDateString() === today.toDateString());
  const earlier = includesToday ? buckets.filter((b) => b.date < today) : [];
  const upcoming = includesToday ? buckets.filter((b) => b.date >= today) : buckets;
  const renderDay = (bucket: DayBucket) => {
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
  };
  return (
    <div className="space-y-6">
      {earlier.some((b) => b.count > 0) && (
        <details className="surface-inset px-4">
          <summary className="text-muted-foreground min-h-11 cursor-pointer py-3 text-sm">
            Earlier this week · {earlier.reduce((n, b) => n + b.count, 0)} events
          </summary>
          <div className="space-y-5 pb-4">{earlier.map(renderDay)}</div>
        </details>
      )}
      {upcoming.map(renderDay)}
    </div>
  );
}
