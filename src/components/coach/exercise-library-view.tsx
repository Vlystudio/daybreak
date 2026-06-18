"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchExercises } from "@/actions/fitness";
import {
  MUSCLE_GROUPS,
  EQUIPMENT_OPTIONS,
  DIFFICULTIES,
  EXERCISE_CATEGORIES,
  type Exercise,
} from "@/lib/fitness";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

export function ExerciseLibraryView() {
  const [pending, startTransition] = useTransition();
  const [muscle, setMuscle] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [location, setLocation] = useState<"home" | "gym" | "any">("any");
  const [results, setResults] = useState<Exercise[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleEquip(e: string) {
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run() {
    startTransition(async () => {
      const res = await searchExercises({
        muscleGroup: muscle || undefined,
        difficulty: difficulty || undefined,
        workoutType: category || undefined,
        equipment: equipment.length ? equipment : undefined,
        location,
      });
      if (res.ok) {
        setResults(res.exercises);
        if (res.exercises.length === 0) toast("No matches — try broadening your filters.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="mb-1.5 text-sm font-medium">Muscle group</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((m) => (
                <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? "" : m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Equipment</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <Chip key={e} active={equipment.includes(e)} onClick={() => toggleEquip(e)}>
                  {e}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-1.5 text-sm font-medium">Difficulty</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(difficulty === d ? "" : d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Type</p>
              <div className="flex flex-wrap gap-2">
                {EXERCISE_CATEGORIES.map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Where</p>
              <div className="flex flex-wrap gap-2">
                {(["any", "home", "gym"] as const).map((l) => (
                  <Chip key={l} active={location === l} onClick={() => setLocation(l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={run} disabled={pending}>
            <Search className="h-4 w-4" aria-hidden /> {pending ? "Searching…" : "Search exercises"}
          </Button>
        </CardContent>
      </Card>

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((ex) => {
            const open = expanded.has(ex.id);
            return (
              <Card key={ex.id}>
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(ex.id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{ex.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="sage">{ex.category}</Badge>
                        <Badge variant="sky">{ex.difficulty}</Badge>
                        <span>{ex.primary_muscles.join(", ")}</span>
                      </p>
                    </div>
                    <ChevronDown
                      className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        Equipment: {ex.equipment.join(", ") || "bodyweight"} · ~{ex.estimated_duration_minutes} min ·{" "}
                        {ex.home_friendly ? "home" : ""}
                        {ex.home_friendly && ex.gym_friendly ? " / " : ""}
                        {ex.gym_friendly ? "gym" : ""}
                      </p>
                      {ex.instructions.length > 0 && (
                        <div>
                          <p className="mb-1 font-medium">How to</p>
                          <ol className="list-decimal space-y-0.5 pl-5">
                            {ex.instructions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {ex.common_mistakes.length > 0 && (
                        <div>
                          <p className="mb-1 font-medium">Common mistakes</p>
                          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                            {ex.common_mistakes.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ex.safety_notes.length > 0 && (
                        <div>
                          <p className="mb-1 font-medium">Safety</p>
                          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                            {ex.safety_notes.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
