"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Sparkles, Plus, X, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  generateWorkout,
  logWorkout,
  addEquipment,
  removeEquipment,
  addLimitation,
  removeLimitation,
} from "@/actions/fitness";
import { FITNESS_DISCLAIMER } from "@/lib/fitness-safety";
import type { UserWorkout, WorkoutItem } from "@/lib/fitness";

type Equip = { id: string; name: string };
type Limit = { id: string; description: string };

const intensityVariant: Record<string, "honey" | "sage" | "sky"> = {
  low: "sage",
  moderate: "sky",
  high: "honey",
};

function ItemList({ title, items }: { title: string; items: WorkoutItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {it.exercise_name}
              {it.notes && <span className="text-muted-foreground"> — {it.notes}</span>}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {it.sets}×{it.reps}
              {it.rest_seconds ? ` · ${it.rest_seconds}s` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkoutDetail({ workout, onLog }: { workout: UserWorkout; onLog: () => void }) {
  const p = workout.plan;
  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{p.workout_title}</CardTitle>
          <div className="flex items-center gap-1.5">
            {workout.status === "completed" && <Badge variant="sage">Done</Badge>}
            {p.intensity && (
              <Badge variant={intensityVariant[p.intensity] ?? "honey"}>{p.intensity}</Badge>
            )}
          </div>
        </div>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Clock className="h-3.5 w-3.5" aria-hidden /> ~{p.estimated_duration_minutes} min ·{" "}
          {format(parseISO(workout.created_at), "MMM d")}
        </p>
        {p.reasoning_summary && <p className="text-foreground/90 text-sm">{p.reasoning_summary}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ItemList title="Warm-up" items={p.warmup} />
        <ItemList title="Workout" items={p.main_workout} />
        <ItemList title="Cool-down" items={p.cooldown} />
        {p.safety_notes?.length > 0 && (
          <div className="border-border rounded-lg border p-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <ShieldAlert className="text-muted-foreground h-4 w-4" aria-hidden /> Safety
            </p>
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
              {p.safety_notes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {p.progression_next_time?.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              Next time
            </p>
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
              {p.progression_next_time.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {workout.status !== "completed" && (
          <Button onClick={onLog} variant="outline" size="sm">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Log this workout
          </Button>
        )}
        <p className="text-muted-foreground/70 text-xs">{FITNESS_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}

export function WorkoutsView({
  latestWorkout,
  history,
  equipment: initialEquipment,
  limitations: initialLimitations,
}: {
  latestWorkout: UserWorkout | null;
  history: UserWorkout[];
  equipment: Equip[];
  limitations: Limit[];
}) {
  const [pending, startTransition] = useTransition();
  const [workout, setWorkout] = useState<UserWorkout | null>(latestWorkout);
  const [time, setTime] = useState("40");
  const [soreness, setSoreness] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);

  const [equipment, setEquipment] = useState<Equip[]>(initialEquipment);
  const [newEquip, setNewEquip] = useState("");
  const [limits, setLimits] = useState<Limit[]>(initialLimitations);
  const [newLimit, setNewLimit] = useState("");

  const [logging, setLogging] = useState(false);
  const [effort, setEffort] = useState("7");
  const [logNotes, setLogNotes] = useState("");

  function generate() {
    setBlocked(null);
    startTransition(async () => {
      const res = await generateWorkout({
        timeAvailableMinutes: Number(time) || 40,
        soreness: soreness.trim() || undefined,
      });
      if (res.ok) {
        setWorkout(res.workout);
        toast.success("Your workout is ready.");
      } else if ("blocked" in res) {
        setBlocked(res.message);
      } else {
        toast.error(res.error);
      }
    });
  }

  function submitLog() {
    if (!workout) return;
    const entries = workout.plan.main_workout.map((it) => ({
      exercise_name: it.exercise_name,
      sets: it.sets,
      reps: it.reps,
      weight: null,
      notes: null,
    }));
    startTransition(async () => {
      const res = await logWorkout({
        workoutId: workout.id,
        entries,
        perceivedEffort: Number(effort) || undefined,
        notes: logNotes.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Logged. Nice work.");
        setLogging(false);
        setWorkout({ ...workout, status: "completed" });
      } else {
        toast.error(res.error);
      }
    });
  }

  function addEquip() {
    const name = newEquip.trim();
    if (!name) return;
    setNewEquip("");
    const tempId = `t-${Date.now()}`;
    setEquipment((e) => [...e, { id: tempId, name }]);
    startTransition(async () => {
      const res = await addEquipment(name);
      if (!res.ok) {
        toast.error(res.error);
        setEquipment((e) => e.filter((x) => x.id !== tempId));
      }
    });
  }
  function removeEquip(id: string) {
    setEquipment((e) => e.filter((x) => x.id !== id));
    startTransition(async () => {
      await removeEquipment(id);
    });
  }
  function addLimit() {
    const d = newLimit.trim();
    if (!d) return;
    setNewLimit("");
    const tempId = `t-${Date.now()}`;
    setLimits((l) => [...l, { id: tempId, description: d }]);
    startTransition(async () => {
      const res = await addLimitation(d);
      if (!res.ok) {
        toast.error(res.error);
        setLimits((l) => l.filter((x) => x.id !== tempId));
      }
    });
  }
  function removeLimit(id: string) {
    setLimits((l) => l.filter((x) => x.id !== id));
    startTransition(async () => {
      await removeLimitation(id);
    });
  }

  return (
    <div className="space-y-5">
      {/* Generate */}
      <Card className="bg-sunrise border-none text-[#5a3d1a]">
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden /> Generate today&apos;s workout
          </h2>
          <p className="text-sm opacity-80">
            Built from your goal, equipment, limitations, and available recent recovery signals.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block opacity-80">Time (min)</span>
              <Input
                type="number"
                min={10}
                max={120}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-card/80 w-24"
              />
            </label>
            <label className="min-w-[180px] flex-1 text-sm">
              <span className="mb-1 block opacity-80">Soreness / how you feel (optional)</span>
              <Input
                value={soreness}
                onChange={(e) => setSoreness(e.target.value)}
                placeholder="e.g. legs sore, low energy"
                className="bg-card/80"
              />
            </label>
            <Button onClick={generate} disabled={pending} className="shadow-soft">
              {pending ? "Building…" : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {blocked && (
        <Card className="border-destructive/40">
          <CardContent className="flex gap-3 p-4 text-sm">
            <ShieldAlert className="text-destructive h-5 w-5 shrink-0" aria-hidden />
            <p>{blocked}</p>
          </CardContent>
        </Card>
      )}

      {workout && <WorkoutDetail workout={workout} onLog={() => setLogging(true)} />}

      {logging && workout && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Log workout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1 block">Perceived effort (1–10)</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                className="w-24"
              />
            </label>
            <Textarea
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="How did it go? Any pain, PRs, or changes?"
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={submitLog} disabled={pending}>
                {pending ? "Saving…" : "Save log"}
              </Button>
              <Button variant="ghost" onClick={() => setLogging(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipment & limitations */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Equipment I have</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newEquip}
                onChange={(e) => setNewEquip(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEquip();
                  }
                }}
                placeholder="e.g. dumbbells, pull-up bar"
                maxLength={60}
              />
              <Button type="button" variant="outline" onClick={addEquip}>
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {equipment.length === 0 && (
                <p className="text-muted-foreground text-sm">Bodyweight only for now.</p>
              )}
              {equipment.map((eq) => (
                <span
                  key={eq.id}
                  className="border-border bg-accent/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                >
                  {eq.name}
                  <button
                    type="button"
                    onClick={() => removeEquip(eq.id)}
                    aria-label={`Remove ${eq.name}`}
                  >
                    <X
                      className="text-muted-foreground hover:text-foreground h-3.5 w-3.5"
                      aria-hidden
                    />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Injuries &amp; limitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLimit();
                  }
                }}
                placeholder="e.g. bad left knee, avoid overhead"
                maxLength={200}
              />
              <Button type="button" variant="outline" onClick={addLimit}>
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {limits.length === 0 && <p className="text-muted-foreground text-sm">None noted.</p>}
              {limits.map((l) => (
                <span
                  key={l.id}
                  className="border-border bg-accent/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                >
                  {l.description}
                  <button
                    type="button"
                    onClick={() => removeLimit(l.id)}
                    aria-label={`Remove ${l.description}`}
                  >
                    <X
                      className="text-muted-foreground hover:text-foreground h-3.5 w-3.5"
                      aria-hidden
                    />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {history.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkout(w);
                      setLogging(false);
                      setBlocked(null);
                    }}
                    className={cn(
                      "hover:text-primary flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm",
                      workout?.id === w.id && "text-primary"
                    )}
                  >
                    <span className="truncate">{w.title}</span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                      {w.status === "completed" && (
                        <CheckCircle2 className="text-primary h-3.5 w-3.5" aria-hidden />
                      )}
                      {format(parseISO(w.created_at), "MMM d")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
