"use client";

import { useState, useTransition } from "react";
import { Check, Flame, Plus, Repeat, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createHabit, toggleHabitToday, archiveHabit } from "@/actions/habits";
import type { HabitStatus } from "@/lib/types";

export function HabitsCard({ habits }: { habits: HabitStatus[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    startTransition(async () => {
      const result = await toggleHabitToday(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await archiveHabit(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createHabit({ name: trimmed });
      if (result.ok) {
        setName("");
        setAdding(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-sage" aria-hidden />
          Habits
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)} aria-label="Add habit">
          <Plus aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pb-6">
        {adding && (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="New habit, e.g. Stretch 5 min"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <Button size="sm" onClick={add} disabled={pending || !name.trim()}>
              Add
            </Button>
          </div>
        )}

        {habits.length === 0 && !adding && (
          <p className="py-3 text-sm text-muted-foreground">
            Build a streak. Add a small daily habit like “Drink water” or “Read 10 min”.
          </p>
        )}

        {habits.map((h) => (
          <div key={h.id} className="group flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggle(h.id)}
              disabled={pending}
              aria-pressed={h.doneToday}
              aria-label={`${h.doneToday ? "Undo" : "Complete"} ${h.name}`}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                h.doneToday
                  ? "border-sage bg-sage text-white"
                  : "border-muted-foreground/30 text-transparent hover:border-sage/60"
              )}
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", h.doneToday && "text-muted-foreground line-through")}>
                {h.emoji ? `${h.emoji} ` : ""}
                {h.name}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {h.streak > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Flame className="h-3 w-3 text-honey" aria-hidden /> {h.streak}d
                  </span>
                )}
                <span>{h.weekCount}/7 this week</span>
              </p>
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
        ))}
      </CardContent>
    </Card>
  );
}
