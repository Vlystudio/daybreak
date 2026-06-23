"use client";

import { useState, useTransition } from "react";
import { Target, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { setNutritionGoals } from "@/actions/intake";

export interface NutritionGoals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

type Totals = { calories: number; protein: number; carbs: number; fat: number };

const MACROS = [
  { key: "calories", goalKey: "calories", label: "Calories", unit: "", color: "bg-primary" },
  { key: "protein", goalKey: "protein_g", label: "Protein", unit: "g", color: "bg-honey" },
  { key: "carbs", goalKey: "carbs_g", label: "Carbs", unit: "g", color: "bg-sky" },
  { key: "fat", goalKey: "fat_g", label: "Fat", unit: "g", color: "bg-sage" },
] as const;

export function MacroTargets({ goals, totals }: { goals: NutritionGoals | null; totals: Totals }) {
  const [editing, setEditing] = useState(false);
  const hasGoals = goals != null && Object.values(goals).some((v) => v != null);

  if (!hasGoals && !editing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            Set daily macro targets and Daybreak tracks what&apos;s left as you log.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Set targets
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) return <GoalsForm goals={goals} onDone={() => setEditing(false)} />;

  const protein = goals?.protein_g ?? null;
  const proteinLeft = protein != null ? Math.round(protein - totals.protein) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          Today vs targets
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Edit targets">
          <Pencil aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {MACROS.map((m) => {
          const goal = goals?.[m.goalKey] ?? null;
          const value = totals[m.key];
          if (goal == null || goal === 0) return null;
          const pct = Math.min(100, Math.round((value / goal) * 100));
          const left = Math.round(goal - value);
          return (
            <div key={m.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{m.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(value)}
                  {m.unit} / {goal}
                  {m.unit} · {left > 0 ? `${left}${m.unit} left` : left < 0 ? `${-left}${m.unit} over` : "done"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", value > goal ? "bg-destructive" : m.color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {proteinLeft != null && proteinLeft > 15 && (
          <p className="rounded-lg bg-honey-soft/50 px-3 py-2 text-xs text-[#9a6b1f]">
            You&apos;re {proteinLeft}g under your protein target — a Greek yogurt, eggs, or a scoop of protein would close
            the gap.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GoalsForm({ goals, onDone }: { goals: NutritionGoals | null; onDone: () => void }) {
  const [vals, setVals] = useState({
    calories: goals?.calories?.toString() ?? "",
    protein_g: goals?.protein_g?.toString() ?? "",
    carbs_g: goals?.carbs_g?.toString() ?? "",
    fat_g: goals?.fat_g?.toString() ?? "",
  });
  const [pending, startTransition] = useTransition();

  function num(s: string): number | null {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  function save() {
    startTransition(async () => {
      const result = await setNutritionGoals({
        calories: num(vals.calories),
        protein_g: num(vals.protein_g),
        carbs_g: num(vals.carbs_g),
        fat_g: num(vals.fat_g),
      });
      if (result.ok) {
        toast.success("Targets saved.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Daily targets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {([["calories", "kcal"], ["protein_g", "protein"], ["carbs_g", "carbs"], ["fat_g", "fat"]] as const).map(
            ([key, label]) => (
              <div key={key}>
                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                <Input
                  inputMode="numeric"
                  value={vals[key]}
                  onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
                  className="px-2 text-center tabular-nums"
                />
              </div>
            )
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending} size="sm" className="flex-1">
            {pending ? "Saving…" : "Save targets"}
          </Button>
          <Button onClick={onDone} disabled={pending} size="sm" variant="ghost">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
