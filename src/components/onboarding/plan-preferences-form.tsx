"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePlanPreferences } from "@/actions/onboarding";
import {
  WORK_DAYS,
  PLANNING_SCOPES,
  AUTO_PLAN_CADENCES,
  type UserPreferences,
} from "@/lib/planning";
import { planPreferencesSchema } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PlanPreferencesForm({ initial }: { initial: UserPreferences | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [workDays, setWorkDays] = useState<string[]>(initial?.work_days ?? []);
  const [workStartTime, setWorkStartTime] = useState(
    initial?.work_start_time?.slice(0, 5) ?? "09:00"
  );
  const [workEndTime, setWorkEndTime] = useState(initial?.work_end_time?.slice(0, 5) ?? "17:00");
  const [wakeTime, setWakeTime] = useState(initial?.wake_time?.slice(0, 5) ?? "07:00");
  const [sleepTime, setSleepTime] = useState(initial?.sleep_time?.slice(0, 5) ?? "23:00");
  const [planningScope, setPlanningScope] = useState(initial?.planning_scope ?? "few_days");
  const [autoPlanCadence, setAutoPlanCadence] = useState(initial?.auto_plan_cadence ?? "off");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input = {
      workDays,
      workStartTime,
      workEndTime,
      wakeTime,
      sleepTime,
      planningScope,
      autoPlanCadence,
    };
    const parsed = planPreferencesSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your times.");
      return;
    }
    startTransition(async () => {
      const result = await savePlanPreferences(parsed.data);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save your preferences.");
        return;
      }
      toast.success("Your plan preferences are saved.");
      router.push("/schedule");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your daily rhythm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Choose the hours you want to plan around. No wearable is required.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-wake">Wake up</Label>
              <Input
                id="plan-wake"
                type="time"
                required
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-sleep">Bedtime</Label>
              <Input
                id="plan-sleep"
                type="time"
                required
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm">
              Keep these hours free. Leave days unselected if this doesn’t apply.
            </legend>
            <div className="flex flex-wrap gap-2">
              {WORK_DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  aria-label={day.value}
                  aria-pressed={workDays.includes(day.value)}
                  onClick={() =>
                    setWorkDays((days) =>
                      days.includes(day.value)
                        ? days.filter((d) => d !== day.value)
                        : [...days, day.value]
                    )
                  }
                  className={cn(
                    "min-h-11 min-w-11 rounded-full border px-3 text-sm",
                    workDays.includes(day.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </fieldset>
          {workDays.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-work-start">Start</Label>
                <Input
                  id="plan-work-start"
                  type="time"
                  required
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-work-end">End</Label>
                <Input
                  id="plan-work-end"
                  type="time"
                  required
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-scope">How far ahead?</Label>
            <select
              id="plan-scope"
              value={planningScope}
              onChange={(e) => setPlanningScope(e.target.value)}
              className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-sm"
            >
              {PLANNING_SCOPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium">
              Automatic planning
            </summary>
            <p id="plan-auto-hint" className="text-muted-foreground mb-3">
              Optional. Requires your AI data-sharing permission. You can always edit your schedule
              yourself.
            </p>
            <Label htmlFor="plan-auto">Refresh my plan</Label>
            <select
              id="plan-auto"
              aria-describedby="plan-auto-hint"
              value={autoPlanCadence}
              onChange={(e) => setAutoPlanCadence(e.target.value)}
              className="border-input bg-background mt-2 min-h-11 w-full rounded-md border px-3 text-sm"
            >
              {AUTO_PLAN_CADENCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </details>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save and view schedule"}
      </Button>
    </form>
  );
}
