"use client";

import { useState, useTransition } from "react";
import { Check, Flame, Plus, Repeat, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createHabit, toggleHabitToday, archiveHabit } from "@/actions/habits";
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

export function HabitsCard({ habits }: { habits: HabitStatus[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("");
  const [color, setColor] = useState<EventColor>("honey");
  const [target, setTarget] = useState(7);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    startTransition(async () => {
      const r = await toggleHabitToday(id);
      if (!r.ok) toast.error(r.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const r = await archiveHabit(id);
      if (!r.ok) toast.error(r.error);
    });
  }
  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const r = await createHabit({ name: trimmed, emoji: emoji || undefined, color, targetPerWeek: target });
      if (r.ok) {
        setName(""); setEmoji(""); setColor("honey"); setTarget(7); setAdding(false);
      } else toast.error(r.error);
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-sage" aria-hidden />
          Habits
          {habits.length > 0 && (
            <span className="rounded-full bg-sage-soft px-2 py-0.5 text-xs font-medium text-sage">
              {habits.filter((h) => h.doneToday).length}/{habits.length} today
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)} aria-label="Add habit">
          <Plus aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-6">
        {adding && (
          <div className="space-y-2.5 rounded-2xl border bg-muted/30 p-3">
            <Input
              autoFocus
              placeholder="New habit, e.g. Drink water"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <div className="flex flex-wrap gap-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji((cur) => (cur === e ? "" : e))}
                  className={cn("rounded-lg px-1.5 py-1 text-base transition-colors", emoji === e ? "bg-primary/15" : "hover:bg-accent")}
                  aria-label={`Emoji ${e}`}
                  aria-pressed={emoji === e}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Color">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setColor(c.key)}
                    aria-label={c.key}
                    aria-pressed={color === c.key}
                    className={cn("h-6 w-6 rounded-full border-2", c.dot, color === c.key ? "border-foreground/50" : "border-transparent")}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {TARGETS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTarget(t.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      target === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={add} disabled={pending || !name.trim()} className="w-full">
              Add habit
            </Button>
          </div>
        )}

        {habits.length === 0 && !adding && (
          <p className="py-3 text-sm text-muted-foreground">
            Build a streak. Add a small daily habit like “Brush teeth” or “Read 10 min”.
          </p>
        )}

        {habits.map((h) => {
          const c = colorOf(h.color);
          const met = h.weekCount >= h.target_per_week;
          return (
            <div key={h.id} className="group flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(h.id)}
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
                  {/* Weekly target as pips — filled = completions this week. */}
                  <span className="flex items-center gap-1" aria-label={`${h.weekCount} of ${h.target_per_week} this week`}>
                    {Array.from({ length: h.target_per_week }).map((_, i) => (
                      <span
                        key={i}
                        className={cn("h-2 w-2 rounded-full", i < h.weekCount ? c.fill : "bg-muted-foreground/20")}
                      />
                    ))}
                  </span>
                  <span className={cn(met && c.text, "font-medium")}>
                    {met ? "goal met 🎉" : `${h.weekCount}/${h.target_per_week}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(h.id)}
                disabled={pending}
                aria-label={`Remove ${h.name}`}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
