"use client";

import { useEffect, useTransition } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createScheduleEvent, updateScheduleEvent, deleteScheduleEvent } from "@/actions/schedule";
import { RecipeDetails } from "@/components/schedule/recipe-details";
import type { ScheduleEvent, EventColor } from "@/lib/types";

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
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

type FormValues = z.infer<typeof formSchema>;

const colorLabels: Record<EventColor, string> = {
  honey: "Honey",
  sage: "Sage",
  sky: "Sky",
  peach: "Peach",
};

function toLocalInput(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

function defaultsFor(event: ScheduleEvent | null, defaultDate: Date): FormValues {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startsAt: toLocalInput(event.starts_at),
      endsAt: toLocalInput(event.ends_at),
      allDay: event.all_day,
      color: event.color ?? "honey",
      shareWithHousehold: event.household_id != null,
    };
  }
  const start = new Date(defaultDate);
  start.setMinutes(0, 0, 0);
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent | null;
  defaultDate: Date;
  hasHousehold: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isGoogleEvent = event?.source === "google";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(event, defaultDate),
  });

  useEffect(() => {
    if (open) form.reset(defaultsFor(event, defaultDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
      };
      const result = event
        ? await updateScheduleEvent(event.id, payload)
        : await createScheduleEvent(payload);

      if (result.ok) {
        toast.success(event ? "Event updated." : "Added to your day.");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function onDelete() {
    if (!event) return;
    startTransition(async () => {
      const result = await deleteScheduleEvent(event.id);
      if (result.ok) {
        toast.success("Event removed.");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const { errors } = form.formState;
  const control = form.control;
  const color = useWatch({ control, name: "color" });
  const shareWithHousehold = useWatch({ control, name: "shareWithHousehold" });
  const allDay = useWatch({ control, name: "allDay" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" placeholder="Morning walk" {...form.register("title")} />
            {errors.title && (
              <p role="alert" className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type={allDay ? "date" : "datetime-local"}
                {...form.register("startsAt")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">Ends</Label>
              <Input
                id="event-end"
                type={allDay ? "date" : "datetime-local"}
                {...form.register("endsAt")}
              />
              {errors.endsAt && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.endsAt.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input id="event-location" placeholder="The park" {...form.register("location")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Notes (optional)</Label>
            <Textarea
              id="event-description"
              rows={2}
              placeholder="Anything to remember"
              {...form.register("description")}
            />
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
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch
                  checked={allDay}
                  onCheckedChange={(v) => form.setValue("allDay", v)}
                  aria-label="All day"
                />
                All day
              </label>
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

          <DialogFooter className="pt-2 sm:items-center sm:justify-between">
            {event ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                disabled={pending}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
