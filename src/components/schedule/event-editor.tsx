"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createScheduleEvent, updateScheduleEvent, deleteScheduleEvent } from "@/actions/schedule";
import { RecipeDetails } from "@/components/schedule/recipe-details";
import type { ScheduleEvent, EventColor } from "@/lib/types";
import {
  conflictingEvents,
  eventInputDate,
  eventInputRange,
  eventLastDay,
  suggestedEventStart,
} from "@/lib/schedule/editor";
import { feedback } from "@/lib/ui/haptics";

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Give your event a name").max(200),
    description: z.string().trim().max(2000),
    location: z.string().trim().max(300),
    startsAt: z.string().min(1, "Pick a start time"),
    endsAt: z.string().min(1, "Pick an end time"),
    allDay: z.boolean(),
    color: z.enum(["honey", "sage", "sky", "peach"]),
    shareWithHousehold: z.boolean(),
  })
  .refine(
    (v) => {
      const range = eventInputRange(v.startsAt, v.endsAt, v.allDay);
      return range.endsAt > range.startsAt;
    },
    {
      message: "End time must be after the start time",
      path: ["endsAt"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

const colorLabels: Record<EventColor, string> = {
  honey: "Honey",
  sage: "Sage",
  sky: "Sky",
  peach: "Peach",
};

function defaultsFor(event: ScheduleEvent | null, defaultDate: Date): FormValues {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startsAt: eventInputDate(event.starts_at, event.all_day),
      endsAt: event.all_day ? eventLastDay(event.ends_at) : eventInputDate(event.ends_at),
      allDay: event.all_day,
      color: event.color ?? "honey",
      shareWithHousehold: event.household_id != null,
    };
  }
  const start = suggestedEventStart(defaultDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    location: "",
    startsAt: format(start, "yyyy-MM-dd'T'HH:mm"),
    endsAt: format(end, "yyyy-MM-dd'T'HH:mm"),
    allDay: false,
    color: "honey",
    shareWithHousehold: false,
  };
}

export function EventEditor({
  open,
  onOpenChange,
  event,
  defaultDate,
  hasHousehold,
  existingEvents = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent | null;
  defaultDate: Date;
  hasHousehold: boolean;
  existingEvents?: ScheduleEvent[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timedHours = useRef({ start: "09:00", end: "10:00" });
  const isGoogleEvent = event?.source === "google";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(event, defaultDate),
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(event, defaultDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  function close() {
    setConfirmDelete(false);
    setError(null);
    onOpenChange(false);
  }

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      try {
        const range = eventInputRange(values.startsAt, values.endsAt, values.allDay);
        const payload = {
          ...values,
          startsAt: range.startsAt.toISOString(),
          endsAt: range.endsAt.toISOString(),
        };
        const result = event
          ? await updateScheduleEvent(event.id, payload)
          : await createScheduleEvent(payload);

        if (result.ok) {
          feedback("success");
          toast.success(event ? "Event updated." : "Added to your day.");
          close();
        } else {
          setError(result.error);
        }
      } catch {
        setError(
          "Couldn't save. Your changes are still here. Check your connection and try again."
        );
      }
    });
  }

  function onDelete() {
    if (!event) return;
    startTransition(async () => {
      try {
        const result = await deleteScheduleEvent(event.id);
        if (result.ok) {
          toast.success("Event removed.");
          close();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Couldn't delete this event. Please try again.");
      }
    });
  }

  const { errors } = form.formState;
  const control = form.control;
  const color = useWatch({ control, name: "color" });
  const shareWithHousehold = useWatch({ control, name: "shareWithHousehold" });
  const allDay = useWatch({ control, name: "allDay" });
  const startsAt = useWatch({ control, name: "startsAt" });
  const endsAt = useWatch({ control, name: "endsAt" });
  const range = eventInputRange(startsAt, endsAt, allDay);
  const conflicts = allDay
    ? []
    : conflictingEvents(existingEvents, range.startsAt, range.endsAt, event?.id);

  function changeAllDay(value: boolean) {
    const start = startsAt.slice(0, 10);
    const end = endsAt.slice(0, 10);
    if (value)
      timedHours.current = {
        start: startsAt.slice(11) || "09:00",
        end: endsAt.slice(11) || "10:00",
      };
    form.setValue("startsAt", value ? start : `${start}T${timedHours.current.start}`);
    form.setValue("endsAt", value ? end : `${end}T${timedHours.current.end}`);
    form.setValue("allDay", value, { shouldValidate: true });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending && !next) close();
      }}
    >
      <DialogContent mobileSheet className="max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-9">
          <DialogTitle>{event ? "Edit event" : "Add to your day"}</DialogTitle>
          <DialogDescription>
            {event?.recipe
              ? "Here's how to make it. Adjust the time below if you like."
              : isGoogleEvent
                ? "This event is synced from Google Calendar — edits here apply only inside Daybreak."
                : "Shape your day around how you feel."}
          </DialogDescription>
        </DialogHeader>

        {event?.recipe && <RecipeDetails recipe={event.recipe} />}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-2 space-y-4"
          noValidate
          aria-busy={pending}
        >
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              placeholder="Morning walk"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "event-title-error" : undefined}
              {...form.register("title")}
            />
            {errors.title && (
              <p id="event-title-error" role="alert" className="text-destructive text-sm">
                {errors.title.message}
              </p>
            )}
          </div>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
            All day
            <Switch checked={allDay} onCheckedChange={changeAllDay} aria-label="All day" />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type={allDay ? "date" : "datetime-local"}
                aria-invalid={Boolean(errors.startsAt)}
                {...form.register("startsAt")}
                value={startsAt}
                onChange={(e) =>
                  form.setValue("startsAt", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              />
              {errors.startsAt && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.startsAt.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">{allDay ? "Last day" : "Ends"}</Label>
              <Input
                id="event-end"
                type={allDay ? "date" : "datetime-local"}
                aria-invalid={Boolean(errors.endsAt)}
                aria-describedby={errors.endsAt ? "event-end-error" : undefined}
                {...form.register("endsAt")}
                value={endsAt}
                onChange={(e) =>
                  form.setValue("endsAt", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              />
              {errors.endsAt && (
                <p id="event-end-error" role="alert" className="text-destructive text-sm">
                  {errors.endsAt.message}
                </p>
              )}
            </div>
          </div>

          {conflicts.length > 0 && (
            <p role="status" className="bg-honey-soft rounded-xl p-3 text-sm">
              Overlaps{" "}
              {conflicts.length === 1 ? `with ${conflicts[0].title}` : `${conflicts.length} events`}{" "}
              in your loaded schedule. You can still save.
            </p>
          )}

          <details
            className="border-border rounded-xl border px-3"
            open={Boolean(errors.description || errors.location) || undefined}
          >
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
              More details · optional
            </summary>
            <div className="space-y-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-location">Location (optional)</Label>
                <Input id="event-location" placeholder="The park" {...form.register("location")} />
                {errors.location && (
                  <p role="alert" className="text-destructive text-sm">
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-description">Notes (optional)</Label>
                <Textarea
                  id="event-description"
                  rows={2}
                  placeholder="Anything to remember"
                  {...form.register("description")}
                />
                {errors.description && (
                  <p role="alert" className="text-destructive text-sm">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <Select
                    value={color}
                    onValueChange={(v) => form.setValue("color", v as EventColor)}
                  >
                    <SelectTrigger aria-label="Event color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(colorLabels) as EventColor[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ background: `var(--${c === "peach" ? "peach" : c})` }}
                            />
                            {colorLabels[c]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-6 pb-1">
                  {hasHousehold && (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Switch
                        checked={shareWithHousehold}
                        onCheckedChange={(v) => form.setValue("shareWithHousehold", v)}
                        aria-label="Share with household"
                      />
                      Household
                    </label>
                  )}
                </div>
              </div>
            </div>
          </details>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {confirmDelete && (
            <div className="border-destructive/30 space-y-2 rounded-xl border p-3" role="alert">
              <p className="text-sm">Permanently delete this event? This cannot be undone.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
                  Delete event
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep event
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="sheet-footer gap-2 pt-2 sm:items-center sm:justify-between">
            {event ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : event ? "Save changes" : "Add event"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
