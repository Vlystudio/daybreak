"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveOnboarding } from "@/actions/onboarding";
import type { OnboardingInput } from "@/lib/validation";
import {
  WORK_TYPES,
  WORK_DAYS,
  FITNESS_GOALS,
  ACTIVITY_LEVELS,
  EXERCISE_FREQUENCIES,
  SOCIAL_TENDENCIES,
  PLANNING_SCOPES,
  AUTO_PLAN_CADENCES,
  SEXES,
  CHORE_FREQUENCIES,
  CHORE_OPTIONS,
  HOBBY_SUGGESTIONS,
  DIETARY_OPTIONS,
  type Option,
  type ChoreEntry,
  type ChoreFrequency,
  type UserPreferences,
} from "@/lib/planning";

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: readonly Option<string>[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-accent"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiChips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onToggle(o)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent"
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-muted-foreground -mt-1 text-xs">{hint}</p>}
      {children}
    </div>
  );
}

export function OnboardingForm({ initial }: { initial: UserPreferences | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [workType, setWorkType] = useState(initial?.work_type ?? "");
  const [workTitle, setWorkTitle] = useState(initial?.work_title ?? "");
  const [workSchedule, setWorkSchedule] = useState(initial?.work_schedule ?? "");
  const [workDays, setWorkDays] = useState<string[]>(initial?.work_days ?? []);
  const [workStart, setWorkStart] = useState(initial?.work_start_time ?? "");
  const [workEnd, setWorkEnd] = useState(initial?.work_end_time ?? "");
  const [wakeTime, setWakeTime] = useState(initial?.wake_time ?? "");
  const [sleepTime, setSleepTime] = useState(initial?.sleep_time ?? "");
  const [fitnessGoal, setFitnessGoal] = useState(initial?.fitness_goal ?? "");
  const [activityLevel, setActivityLevel] = useState(initial?.activity_level ?? "");
  const [exerciseFrequency, setExerciseFrequency] = useState(initial?.exercise_frequency ?? "");

  const initFt = initial?.height_in != null ? Math.floor(initial.height_in / 12) : "";
  const initIn = initial?.height_in != null ? initial.height_in % 12 : "";
  const [heightFt, setHeightFt] = useState<string>(String(initFt));
  const [heightInches, setHeightInches] = useState<string>(String(initIn));
  const [weightLb, setWeightLb] = useState(
    initial?.weight_lb != null ? String(initial.weight_lb) : ""
  );
  const [sex, setSex] = useState(initial?.sex ?? "");

  const [hobbies, setHobbies] = useState<string[]>(initial?.hobbies ?? []);
  const [customHobby, setCustomHobby] = useState("");
  const [socialTendency, setSocialTendency] = useState(initial?.social_tendency ?? "");

  const [chores, setChores] = useState<ChoreEntry[]>(initial?.chores ?? []);
  const [dietary, setDietary] = useState<string[]>(initial?.dietary_restrictions ?? []);
  const [dietaryNotes, setDietaryNotes] = useState(initial?.dietary_notes ?? "");
  const [planningScope, setPlanningScope] = useState(initial?.planning_scope ?? "");
  const [autoPlanCadence, setAutoPlanCadence] = useState(initial?.auto_plan_cadence ?? "off");

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function addCustomHobby() {
    const h = customHobby.trim();
    if (h && !hobbies.includes(h)) setHobbies([...hobbies, h]);
    setCustomHobby("");
  }

  function toggleChore(name: string) {
    setChores((prev) =>
      prev.some((c) => c.name === name)
        ? prev.filter((c) => c.name !== name)
        : [...prev, { name, frequency: "weekly" }]
    );
  }

  function setChoreFreq(name: string, frequency: ChoreFrequency) {
    setChores((prev) => prev.map((c) => (c.name === name ? { ...c, frequency } : c)));
  }

  const customHobbies = hobbies.filter(
    (h) => !HOBBY_SUGGESTIONS.includes(h as (typeof HOBBY_SUGGESTIONS)[number])
  );

  function handleSubmit() {
    if (
      !workType ||
      !fitnessGoal ||
      !activityLevel ||
      !exerciseFrequency ||
      !socialTendency ||
      !planningScope
    ) {
      toast.error("Please answer the required questions (marked *).");
      return;
    }

    const ft = parseInt(heightFt, 10);
    const inch = parseInt(heightInches, 10);
    const heightIn =
      !Number.isNaN(ft) || !Number.isNaN(inch)
        ? (Number.isNaN(ft) ? 0 : ft) * 12 + (Number.isNaN(inch) ? 0 : inch)
        : undefined;

    const input: OnboardingInput = {
      workType,
      workTitle,
      workSchedule,
      workStartTime: workStart,
      workEndTime: workEnd,
      wakeTime,
      sleepTime,
      workDays,
      fitnessGoal,
      activityLevel,
      exerciseFrequency,
      heightIn,
      weightLb: weightLb ? Number(weightLb) : undefined,
      sex: sex || undefined,
      hobbies,
      socialTendency,
      chores,
      dietaryRestrictions: dietary,
      dietaryNotes,
      planningScope,
      autoPlanCadence,
    };

    startTransition(async () => {
      const res = await saveOnboarding(input);
      if (res.ok) {
        toast.success("Your plan profile is saved.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Work */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="What kind of work do you do?">
            <ChipGroup options={WORK_TYPES} value={workType} onChange={setWorkType} />
          </Field>
          <Field label="What's your role / job title?" hint="Optional — helps tailor suggestions.">
            <Input
              value={workTitle}
              onChange={(e) => setWorkTitle(e.target.value)}
              placeholder="e.g. Nurse, Software engineer"
              maxLength={120}
            />
          </Field>
          <Field
            label="What's your typical work schedule?"
            hint="Optional notes — e.g. rotating shifts, on-call."
          >
            <Input
              value={workSchedule}
              onChange={(e) => setWorkSchedule(e.target.value)}
              placeholder="e.g. rotating shifts"
              maxLength={200}
            />
          </Field>
          <Field
            label="Which days do you work?"
            hint="Daybreak keeps these hours free of personal plans — no need to put work on Google Calendar."
          >
            <div className="flex flex-wrap gap-2">
              {WORK_DAYS.map((d) => {
                const active = workDays.includes(d.value);
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => toggle(workDays, setWorkDays, d.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Work start">
              <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
            </Field>
            <Field label="Work end">
              <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Daily rhythm */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily rhythm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">When does your day start and end?</p>
            <p className="text-muted-foreground -mt-1 text-xs">
              Your goal wake and bedtime — the planner schedules only within this window. If your
              Oura ring is connected, your actual sleep/wake takes over automatically.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Wake up">
                <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
              </Field>
              <Field label="Bedtime">
                <Input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fitness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fitness *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="What's your main physical goal?">
            <ChipGroup options={FITNESS_GOALS} value={fitnessGoal} onChange={setFitnessGoal} />
          </Field>
          <Field label="How active are you day to day right now?">
            <ChipGroup
              options={ACTIVITY_LEVELS}
              value={activityLevel}
              onChange={setActivityLevel}
            />
          </Field>
          <Field label="How often do you exercise or do something that raises your heart rate?">
            <ChipGroup
              options={EXERCISE_FREQUENCIES}
              value={exerciseFrequency}
              onChange={setExerciseFrequency}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Body metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Body basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Optional, but the personal trainer needs these to build a workout and nutrition plan.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Height (ft)">
              <Input
                type="number"
                min={3}
                max={8}
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                placeholder="5"
              />
            </Field>
            <Field label="Height (in)">
              <Input
                type="number"
                min={0}
                max={11}
                value={heightInches}
                onChange={(e) => setHeightInches(e.target.value)}
                placeholder="10"
              />
            </Field>
            <Field label="Weight (lb)">
              <Input
                type="number"
                min={50}
                max={800}
                value={weightLb}
                onChange={(e) => setWeightLb(e.target.value)}
                placeholder="160"
              />
            </Field>
          </div>
          <Field label="Sex (for nutrition calculations)">
            <ChipGroup options={SEXES} value={sex} onChange={setSex} />
          </Field>
        </CardContent>
      </Card>

      {/* Hobbies & lifestyle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hobbies & lifestyle *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="What do you enjoy doing?" hint="Pick any that fit — add your own too.">
            <MultiChips
              options={HOBBY_SUGGESTIONS}
              selected={hobbies}
              onToggle={(v) => toggle(hobbies, setHobbies, v)}
            />
            {customHobbies.length > 0 && (
              <div className="mt-2">
                <MultiChips
                  options={customHobbies}
                  selected={hobbies}
                  onToggle={(v) => toggle(hobbies, setHobbies, v)}
                />
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <Input
                value={customHobby}
                onChange={(e) => setCustomHobby(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomHobby();
                  }
                }}
                placeholder="Add another hobby"
                maxLength={40}
              />
              <Button type="button" variant="outline" onClick={addCustomHobby}>
                Add
              </Button>
            </div>
          </Field>
          <Field label="Which sounds most like you?">
            <ChipGroup
              options={SOCIAL_TENDENCIES}
              value={socialTendency}
              onChange={setSocialTendency}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Chores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Which chores do you handle?"
            hint="Select the ones you do, then set how often."
          >
            <MultiChips
              options={CHORE_OPTIONS}
              selected={chores.map((c) => c.name)}
              onToggle={toggleChore}
            />
          </Field>
          {chores.length > 0 && (
            <div className="border-border space-y-2 rounded-lg border p-3">
              {chores.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <span>{c.name}</span>
                  <select
                    value={c.frequency}
                    onChange={(e) => setChoreFreq(c.name, e.target.value as ChoreFrequency)}
                    className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                  >
                    {CHORE_FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Any dietary restrictions or allergies?">
            <MultiChips
              options={DIETARY_OPTIONS}
              selected={dietary}
              onToggle={(v) => toggle(dietary, setDietary, v)}
            />
          </Field>
          <Field
            label="Anything else about your diet?"
            hint="Optional — other allergies, dislikes, preferences."
          >
            <Textarea
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="e.g. severe sesame allergy, don't like cilantro, trying to cut sugar"
              maxLength={500}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Planning scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning *</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="What kind of planning do you want from Daybreak?">
            <ChipGroup
              options={PLANNING_SCOPES}
              value={planningScope}
              onChange={setPlanningScope}
            />
          </Field>
          <Field
            label="Build it for me automatically?"
            hint="Daybreak can regenerate your plan on this cadence each morning — no need to press Generate. Today can use recovery signals only from sources you connect."
          >
            <ChipGroup
              options={AUTO_PLAN_CADENCES}
              value={autoPlanCadence}
              onChange={setAutoPlanCadence}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={pending} className="shadow-soft">
          {pending ? "Saving…" : "Save my plan profile"}
        </Button>
      </div>
    </div>
  );
}
