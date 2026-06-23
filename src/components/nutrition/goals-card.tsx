"use client";

import { useState, useTransition } from "react";
import { Target, Plus, Trophy, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createGoal, deleteGoal } from "@/actions/goals";
import type { GoalProgress } from "@/lib/types";

type Metric = "weight" | "body_fat";
const METRIC_LABEL: Record<Metric, string> = { weight: "Weight", body_fat: "Body fat" };

export function GoalsCard({
  goals,
  latestWeightLb,
  latestBodyFat,
}: {
  goals: GoalProgress[];
  latestWeightLb: number | null;
  latestBodyFat: number | null;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          Goals
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)} aria-label="Add goal">
          <Plus aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <GoalForm
            latestWeightLb={latestWeightLb}
            latestBodyFat={latestBodyFat}
            onDone={() => setAdding(false)}
          />
        )}

        {goals.length === 0 && !adding && (
          <p className="py-2 text-sm text-muted-foreground">
            Set a target — a goal weight or body-fat % by a date — and Daybreak tracks your pace.
          </p>
        )}

        {goals.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </CardContent>
    </Card>
  );
}

function GoalRow({ goal }: { goal: GoalProgress }) {
  const [pending, startTransition] = useTransition();
  const pct = Math.round(goal.pctComplete * 100);

  function remove() {
    startTransition(async () => {
      const result = await deleteGoal(goal.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {goal.reached && <Trophy className="h-4 w-4 text-honey" aria-hidden />}
            {METRIC_LABEL[goal.metric]} → {goal.targetDisplay}
            {goal.unit}
          </p>
          <p className="text-xs text-muted-foreground">
            Now {goal.currentDisplay}
            {goal.unit} · from {goal.startDisplay}
            {goal.unit}
            {goal.daysLeft != null && goal.daysLeft >= 0 ? ` · ${goal.daysLeft}d left` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Remove goal"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", goal.reached ? "bg-sage" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{pct}%</span>
        {goal.reached ? (
          <span className="font-medium text-sage">Reached 🎉</span>
        ) : goal.onTrack != null ? (
          <span className={cn("inline-flex items-center gap-1", goal.onTrack ? "text-sage" : "text-honey")}>
            <TrendingUp className="h-3 w-3" aria-hidden />
            {goal.onTrack ? "On track" : "Behind pace"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GoalForm({
  latestWeightLb,
  latestBodyFat,
  onDone,
}: {
  latestWeightLb: number | null;
  latestBodyFat: number | null;
  onDone: () => void;
}) {
  const [metric, setMetric] = useState<Metric>("weight");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();

  const prefill = metric === "weight" ? latestWeightLb : latestBodyFat;
  const currentValue = current || (prefill != null ? String(prefill) : "");

  function save() {
    const c = parseFloat(currentValue);
    const t = parseFloat(target);
    if (!isFinite(c) || !isFinite(t)) {
      toast.error("Enter your current and target value.");
      return;
    }
    startTransition(async () => {
      const result = await createGoal({
        metric,
        currentDisplay: c,
        targetDisplay: t,
        targetDate: date || undefined,
      });
      if (result.ok) {
        toast.success("Goal set.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex gap-1.5">
        {(["weight", "body_fat"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              metric === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            )}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">{metric === "weight" ? "lb" : "%"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Current</label>
          <Input inputMode="decimal" value={currentValue} onChange={(e) => setCurrent(e.target.value)} className="tabular-nums" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Target</label>
          <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="tabular-nums" />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Target date (optional)</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Button onClick={save} disabled={pending} size="sm" className="w-full">
        {pending ? "Saving…" : "Set goal"}
      </Button>
    </div>
  );
}
