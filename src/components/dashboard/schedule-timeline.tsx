"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Plus, MapPin, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventEditor } from "@/components/schedule/event-editor";
import type { ScheduleEvent } from "@/lib/types";

const colorDot: Record<string, string> = {
  honey: "bg-honey",
  sage: "bg-sage",
  sky: "bg-sky",
  peach: "bg-peach",
};

export function ScheduleTimeline({
  events,
  hasHousehold,
}: {
  events: ScheduleEvent[];
  hasHousehold: boolean;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(event: ScheduleEvent) {
    setEditing(event);
    setEditorOpen(true);
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          Today&apos;s schedule
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/schedule">
              Full week
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus aria-hidden />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        {events.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-muted-foreground">A beautifully open day.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={openNew}>
              <Plus aria-hidden />
              Plan something gentle
            </Button>
          </div>
        ) : (
          <ol className="relative space-y-1" aria-label="Today's events">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => openEdit(event)}
                  className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="w-16 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                    {event.all_day ? "All day" : format(new Date(event.starts_at), "h:mm a")}
                  </div>
                  <div
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colorDot[event.color ?? "honey"]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      {!event.all_day && (
                        <span>
                          {format(new Date(event.starts_at), "h:mm")}–
                          {format(new Date(event.ends_at), "h:mm a")}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {event.location}
                        </span>
                      )}
                    </p>
                  </div>
                  {event.source === "google" && <Badge variant="sky">Google</Badge>}
                  {event.household_id && <Badge variant="sage">Shared</Badge>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <EventEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={editing}
        defaultDate={new Date()}
        hasHousehold={hasHousehold}
      />
    </Card>
  );
}
