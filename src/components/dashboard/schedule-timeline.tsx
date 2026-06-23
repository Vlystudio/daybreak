"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Plus, MapPin, ArrowRight, Circle, CheckCircle2, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventEditor } from "@/components/schedule/event-editor";
import { toggleEventCompleted } from "@/actions/schedule";
import { ConfettiBurst } from "@/components/confetti-burst";
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
  const [, startTransition] = useTransition();
  const [burst, setBurst] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>(
    () => Object.fromEntries(events.map((e) => [e.id, e.completed_at != null]))
  );
  // Mount-time clock, refreshed each minute, so the "now" highlight stays pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(event: ScheduleEvent) {
    setEditing(event);
    setEditorOpen(true);
  }

  function toggle(event: ScheduleEvent) {
    const next = !done[event.id];
    setDone((d) => ({ ...d, [event.id]: next }));
    if (next) setBurst((b) => b + 1); // celebrate finishing a task
    startTransition(async () => {
      const res = await toggleEventCompleted(event.id, next);
      if (!res.ok) {
        setDone((d) => ({ ...d, [event.id]: !next })); // revert
        toast.error(res.error);
      }
    });
  }

  // Highlight the event happening now, or the next upcoming one if none is.
  const currentId = events.find(
    (e) => !e.all_day && new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() > now
  )?.id;
  const nextId = currentId
    ? undefined
    : events.find((e) => !e.all_day && new Date(e.starts_at).getTime() > now)?.id;

  return (
    <Card className="relative h-full">
      {burst > 0 && <ConfettiBurst key={burst} />}
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
            {events.map((event) => {
              const isDone = done[event.id];
              const isCurrent = event.id === currentId;
              const isNext = event.id === nextId;
              return (
                <li key={event.id}>
                  <div
                    className={cn(
                      "group flex items-start gap-2 rounded-xl p-2.5 transition-colors",
                      isCurrent ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-accent"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(event)}
                      aria-label={isDone ? "Mark not done" : "Mark done"}
                      className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
                      ) : (
                        <Circle className="h-5 w-5" aria-hidden />
                      )}
                    </button>
                    <div className="w-14 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                      {event.all_day ? "All day" : format(new Date(event.starts_at), "h:mm a")}
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        colorDot[event.color ?? "honey"]
                      )}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(event)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none"
                    >
                      <p className={cn("truncate font-medium", isDone && "text-muted-foreground line-through")}>
                        {event.title}
                      </p>
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
                      {event.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
                          {event.description}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isCurrent && <Badge variant="honey">Now</Badge>}
                      {isNext && <Badge variant="outline">Next</Badge>}
                      {event.source === "google" && <Badge variant="sky">Google</Badge>}
                      {event.household_id && <Badge variant="sage">Shared</Badge>}
                      {event.plan_type === "workout" && (
                        <Link
                          href="/coach"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Dumbbell className="h-3 w-3" aria-hidden /> Workout
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
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
