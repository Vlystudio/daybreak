"use client";

import { useState, useTransition } from "react";
import { Check, Flame, Plus, Repeat, X, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfettiBurst } from "@/components/confetti-burst";
import { createHabit, updateHabit, toggleHabitToday, archiveHabit } from "@/actions/habits";
import type { EventColor, HabitStatus } from "@/lib/types";

const COLORS: { key: EventColor; dot: string; ring: string; fill: string; text: string; hover: string }[] = [
  { key: "honey", dot: "bg-honey", ring: "border-honey", fill: "bg-honey", text: "text-honey", hover: "hover:border-honey/60" },
  { key: "sage", dot: "bg-sage", ring: "border-sage", fill: "bg-sage", text: "text-sage", hover: "hover:border-sage/60" },
  { key: "sky", dot: "bg-sky", ring: "border-sky", fill: "bg-sky", text: "text-sky", hover: "hover:border-sky/60" },
  { key: "peach", dot: "bg-peach", ring: "border-peach", fill: "bg-peach", text: "text-peach", hover: "hover:border-peach/60" },
];
const colorOf = (c: EventColor) => COLORS.find((x) => x.key === c) ?? COLORS[0];

const EMOJI = ["💧", "🦷", "🚿", "🏃", "🧘", "📖", "🥦", "😴", "💊", "🧹", "✍️", "🎯"];
const TARGETS = [
  { value: 7, label: "Daily" },
  { value: 5, label: "5×/wk" },
  { value: 3, label: "3×/wk" },
];

interface Preset {
  name: string;
  emoji: string;
  color: EventColor;
  target: number;
}

const HABIT_PRESETS: { group: string; items: Preset[] }[] = [
  {
    group: "Hygiene",
    items: [
      { name: "Brush teeth", emoji: "🦷", color: "sky", target: 7 },
      { name: "Floss", emoji: "🧵", color: "sky", target: 7 },
      { name: "Shower", emoji: "🚿", color: "sky", target: 7 },
      { name: "Wash face", emoji: "🧼", color: "sky", target: 7 },
      { name: "Skincare", emoji: "✨", color: "peach", target: 7 },
      { name: "Deodorant", emoji: "🧴", color: "sky", target: 7 },
    ],
  },
  {
    group: "Health",
    items: [
      { name: "Drink water", emoji: "💧", color: "sky", target: 7 },
      { name: "Take vitamins", emoji: "💊", color: "sage", target: 7 },
      { name: "8 hours of sleep", emoji: "😴", color: "sky", target: 7 },
      { name: "Get sunlight", emoji: "🌞", color: "honey", target: 7 },
      { name: "No screens before bed", emoji: "🌙", color: "peach", target: 5 },
    ],
  },
  {
    group: "Movement",
    items: [
      { name: "Go for a walk", emoji: "🚶", color: "sage", target: 7 },
      { name: "Stretch", emoji: "🧘", color: "sage", target: 7 },
      { name: "Workout", emoji: "🏋️", color: "peach", target: 4 },
      { name: "10k steps", emoji: "👟", color: "sage", target: 5 },
    ],
  },
  {
    group: "Mind",
    items: [
      { name: "Meditate", emoji: "🧘", color: "sage", target: 7 },
      { name: "Journal", emoji: "✍️", color: "peach", target: 7 },
      { name: "Read 10 min", emoji: "📖", color: "honey", target: 7 },
      { name: "Write gratitude", emoji: "🙏", color: "honey", target: 7 },
    ],
  },
  {
    group: "Home & tasks",
    items: [
      { name: "Make the bed", emoji: "🛏️", color: "honey", target: 7 },
      { name: "Do the dishes", emoji: "🍽️", color: "sky", target: 7 },
      { name: "Tidy 10 min", emoji: "🧹", color: "sage", target: 7 },
      { name: "Laundry", emoji: "🧺", color: "sky", target: 1 },
    ],
  },
  {
    group: "Nutrition",
    items: [
      { name: "Eat vegetables", emoji: "🥦", color: "sage", target: 7 },
      { name: "Cook at home", emoji: "🍳", color: "honey", target: 5 },
      { name: "No soda", emoji: "🥤", color: "sky", target: 7 },
    ],
  },
];

export function HabitsCard({ habits }: { habits: HabitStatus[] }) {
  // formMode: null = closed, "add" = creating, otherwise a habit id = editing.
  const [formMode, setFormMode] = useState<null | "add" | string>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("");
  const [color, setColor] = useState<EventColor>("honey");
  const [target, setTarget] = useState(7);
  const [burst, setBurst] = useState(0);
  const [pending, startTransition] = useTransition();

  const doneToday = habits.filter((h) => h.doneToday).length;
  const allDone = habits.length > 0 && doneToday === habits.length;

  function reset() {
    setName(""); setEmoji(""); setColor("honey"); setTarget(7);
  }
  function startAdd() {
    if (formMode === "add") return setFormMode(null);
    reset();
    setFormMode("add");
  }
  function startEdit(h: HabitStatus) {
    setName(h.name); setEmoji(h.emoji ?? ""); setColor(h.color); setTarget(h.target_per_week);
    setFormMode(h.id);
  }
  function applyPreset(presetName: string) {
    const p = HABIT_PRESETS.flatMap((g) => g.items).find((x) => x.name === presetName);
    if (!p) return;
    setName(p.name); setEmoji(p.emoji); setColor(p.color); setTarget(p.target);
  }

  function toggle(h: HabitStatus) {
    if (!h.doneToday) setBurst((b) => b + 1); // celebrate completing
    startTransition(async () => {
      const r = await toggleHabitToday(h.id);
      if (!r.ok) toast.error(r.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const r = await archiveHabit(id);
      if (!r.ok) toast.error(r.error);
    });
  }
  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const r =
        formMode === "add"
          ? await createHabit({ name: trimmed, emoji: emoji || undefined, color, targetPerWeek: target })
          : await updateHabit({ id: formMode as string, name: trimmed, emoji: emoji || undefined, color, targetPerWeek: target });
      if (r.ok) {
        setFormMode(null);
        reset();
      } else toast.error(r.error);
    });
  }

  return (
    <Card className="relative h-full">
      {burst > 0 && <ConfettiBurst key={burst} />}
      {burst > 0 && (
        <div key={`seed-${burst}`} className="pointer-events-none absolute inset-x-0 top-9 z-10 flex justify-center">
          <span className="seed-pop text-sm font-bold text-sage">+5 🌱</span>
        </div>
      )}
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-sage" aria-hidden />
          Habits
          {habits.length > 0 && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", allDone ? "bg-sage text-white" : "bg-sage-soft text-sage")}>
              {allDone ? "all done 🎉" : `${doneToday}/${habits.length} today`}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={startAdd} aria-label="Add habit">
          <Plus aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-6">
        {formMode !== null && (
          <div className="space-y-2.5 rounded-2xl border bg-muted/30 p-3">
            {formMode === "add" && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Pick a common one</label>
                  <select value="" onChange={(e) => applyPreset(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                    <option value="" disabled>Choose from hygiene, health, movement…</option>
                    {HABIT_PRESETS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((p) => (
                          <option key={p.name} value={p.name}>{p.emoji} {p.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">or make your own</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <Input
              autoFocus
              placeholder="Habit name, e.g. Drink water"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <div className="flex flex-wrap gap-1">
              {EMOJI.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji((cur) => (cur === e ? "" : e))} aria-pressed={emoji === e} aria-label={`Emoji ${e}`} className={cn("rounded-lg px-1.5 py-1 text-base transition-colors", emoji === e ? "bg-primary/15" : "hover:bg-accent")}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Color">
                {COLORS.map((c) => (
                  <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.key} aria-pressed={color === c.key} className={cn("h-6 w-6 rounded-full border-2", c.dot, color === c.key ? "border-foreground/50" : "border-transparent")} />
                ))}
              </div>
              <div className="flex gap-1">
                {TARGETS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setTarget(t.value)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", target === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending || !name.trim()} className="flex-1">
                {formMode === "add" ? "Add habit" : "Save changes"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFormMode(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {habits.length === 0 && formMode === null && (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-soft text-xl">🌱</span>
            <p className="text-sm font-medium">Start a streak</p>
            <p className="max-w-[15rem] text-xs text-muted-foreground">Add a small daily habit — brushing teeth, water, a 10-minute read.</p>
            <Button size="sm" variant="secondary" onClick={startAdd} className="mt-1">
              <Plus aria-hidden /> Add a habit
            </Button>
          </div>
        )}

        {habits.map((h) => {
          const c = colorOf(h.color);
          const met = h.weekCount >= h.target_per_week;
          return (
            <div key={h.id} className="group flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(h)}
                disabled={pending}
                aria-pressed={h.doneToday}
                aria-label={`${h.doneToday ? "Undo" : "Complete"} ${h.name}`}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  h.doneToday ? cn(c.ring, c.fill, "text-white") : cn("border-muted-foreground/30 text-transparent", c.hover)
                )}
              >
                <Check className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", h.doneToday && "text-muted-foreground line-through")}>
                  {h.emoji ? `${h.emoji} ` : ""}
                  {h.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {h.streak > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-honey">
                      <Flame className="h-3.5 w-3.5" aria-hidden /> {h.streak}
                    </span>
                  )}
                  <span className="flex items-center gap-1" aria-label={`${h.weekCount} of ${h.target_per_week} this week`}>
                    {Array.from({ length: h.target_per_week }).map((_, i) => (
                      <span key={i} className={cn("h-2 w-2 rounded-full", i < h.weekCount ? c.fill : "bg-muted-foreground/20")} />
                    ))}
                  </span>
                  <span className={cn(met ? c.text : "", "font-medium")}>
                    {met ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Sparkles className="h-3 w-3" aria-hidden /> met
                      </span>
                    ) : (
                      `${h.weekCount}/${h.target_per_week}`
                    )}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => startEdit(h)} disabled={pending} aria-label={`Edit ${h.name}`} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => remove(h.id)} disabled={pending} aria-label={`Remove ${h.name}`} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
