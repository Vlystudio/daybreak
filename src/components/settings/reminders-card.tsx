"use client";

import { useState, useTransition } from "react";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createReminder, toggleReminder, deleteReminder } from "@/actions/reminders";
import type { Reminder, ReminderKind } from "@/lib/types";

const KINDS: { value: ReminderKind; label: string }[] = [
  { value: "hydration", label: "Hydration" },
  { value: "wind_down", label: "Wind-down" },
  { value: "move", label: "Move break" },
  { value: "log_food", label: "Log meals" },
  { value: "checkin", label: "Check-in" },
  { value: "custom", label: "Custom" },
];
const labelFor = (k: ReminderKind) => KINDS.find((x) => x.value === k)?.label ?? k;

function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

export function RemindersCard({ reminders, pushAvailable }: { reminders: Reminder[]; pushAvailable: boolean }) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<ReminderKind>("hydration");
  const [time, setTime] = useState("14:00");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const hour = parseInt(time.split(":")[0] ?? "", 10);
    if (!Number.isFinite(hour)) return toast.error("Pick a time.");
    startTransition(async () => {
      const result = await createReminder({ kind, hour, message: message.trim() || undefined });
      if (result.ok) {
        setAdding(false);
        setMessage("");
        toast.success("Reminder added.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleReminder(id, enabled);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteReminder(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-honey" aria-hidden />
            Reminders
          </CardTitle>
          <CardDescription>Gentle push nudges at the times you choose</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)} aria-label="Add reminder">
          <Plus aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!pushAvailable && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Turn on push notifications above to receive reminders.
          </p>
        )}

        {adding && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (kind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
              {kind === "custom" && (
                <Input
                  placeholder="Reminder text"
                  value={message}
                  maxLength={140}
                  onChange={(e) => setMessage(e.target.value)}
                />
              )}
            </div>
            <Button onClick={add} disabled={pending} size="sm" className="w-full">
              {pending ? "Adding…" : "Add reminder"}
            </Button>
          </div>
        )}

        {reminders.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">
            No reminders yet. Add a hydration nudge, a wind-down cue, or a daily check-in.
          </p>
        ) : (
          reminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{r.kind === "custom" && r.message ? r.message : labelFor(r.kind)}</p>
                <p className="text-xs text-muted-foreground">{hourLabel(r.hour)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={r.enabled}
                  disabled={pending}
                  aria-label={`${labelFor(r.kind)} reminder`}
                  onCheckedChange={(v) => toggle(r.id, v)}
                />
                <button type="button" onClick={() => remove(r.id)} disabled={pending} aria-label="Remove reminder" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
