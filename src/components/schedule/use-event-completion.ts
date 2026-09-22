"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";
import { toggleEventCompleted } from "@/actions/schedule";
import { feedback } from "@/lib/ui/haptics";
import type { ScheduleEvent } from "@/lib/types";

/** Optimistic changes live only for the action; rejected writes roll back automatically. */
export function useEventCompletion(events: ScheduleEvent[]) {
  const [, startTransition] = useTransition();
  const inFlight = useRef(new Set<string>());
  const revisions = useRef(new Map<string, number>());
  const [items, update] = useOptimistic(
    events,
    (current, change: { id: string; completedAt: string | null }) =>
      current.map((event) =>
        event.id === change.id ? { ...event, completed_at: change.completedAt } : event
      )
  );

  function setCompleted(event: ScheduleEvent, done: boolean, offerUndo = true) {
    if (inFlight.current.has(event.id)) return;
    inFlight.current.add(event.id);
    const revision = (revisions.current.get(event.id) ?? 0) + 1;
    revisions.current.set(event.id, revision);
    startTransition(async () => {
      update({ id: event.id, completedAt: done ? new Date().toISOString() : null });
      try {
        const result = await toggleEventCompleted(event.id, done);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        feedback(done ? "success" : "selection");
        toast.success(done ? "Marked as done" : "Marked as not done", {
          id: `completion-${event.id}`,
          duration: offerUndo ? 8000 : 4000,
          action: offerUndo
            ? {
                label: "Undo",
                onClick: () => {
                  if (revisions.current.get(event.id) === revision)
                    setCompleted(event, !done, false);
                },
              }
            : undefined,
        });
      } catch {
        toast.error("Couldn't save. Check your connection and try again.");
      } finally {
        inFlight.current.delete(event.id);
      }
    });
  }

  return { items, toggleDone: (event: ScheduleEvent) => setCompleted(event, !event.completed_at) };
}
