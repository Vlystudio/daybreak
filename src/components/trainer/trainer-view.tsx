"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Apple, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateFitnessPlan } from "@/actions/trainer";
import { format, parseISO } from "date-fns";
import type { FitnessPlan } from "@/lib/planning";

function Macro({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <p className="text-xl font-semibold tabular-nums">
        {value ?? "—"}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function TrainerView({ plan, hasMetrics }: { plan: FitnessPlan | null; hasMetrics: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await generateFitnessPlan();
      if (res.ok) {
        toast.success("Your regimen is ready.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!hasMetrics) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium">First, add your body basics.</p>
          <p className="text-muted-foreground">
            The trainer needs your height and weight (and ideally sex and birth year) to calculate your
            calorie and macro targets. Add them on the Plan tab, then come back here.
          </p>
          <Button asChild>
            <Link href="/onboarding">Go to Plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="bg-sunrise border-none text-[#5a3d1a]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4" aria-hidden /> {plan ? "Your regimen" : "Build your regimen"}
            </h2>
            <p className="mt-1 max-w-md text-sm opacity-80">
              {plan
                ? "Regenerate any time — e.g. after updating your weight or goal on the Plan tab."
                : "Generate a workout program and nutrition plan tailored to your goal and dietary needs."}
            </p>
          </div>
          <Button onClick={run} disabled={pending} className="shrink-0 shadow-soft">
            {pending ? "Building…" : plan ? "Regenerate" : "Generate my regimen"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <>
          {plan.summary && <p className="text-sm leading-relaxed text-foreground/90">{plan.summary}</p>}

          {/* Macro targets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="h-4 w-4" aria-hidden /> Daily nutrition targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Macro label="Calories" value={plan.calorie_target} unit="kcal" />
                <Macro label="Protein" value={plan.protein_g} unit="g" />
                <Macro label="Carbs" value={plan.carbs_g} unit="g" />
                <Macro label="Fat" value={plan.fat_g} unit="g" />
              </div>
              {plan.nutrition?.strategy && (
                <p className="text-sm text-muted-foreground">{plan.nutrition.strategy}</p>
              )}
              {plan.nutrition?.guidance?.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {plan.nutrition.guidance.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              )}
              {plan.nutrition?.sampleDay?.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sample day
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {plan.nutrition.sampleDay.map((m, i) => (
                      <li key={i}>
                        <span className="font-medium">{m.meal}:</span> {m.idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workout program */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-4 w-4" aria-hidden /> Workout — {plan.workout?.split}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.workout?.days?.map((d, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{d.day}</p>
                  {d.focus && <p className="text-xs text-muted-foreground">{d.focus}</p>}
                  <ul className="mt-2 space-y-1 text-sm">
                    {d.exercises.map((ex, j) => (
                      <li key={j} className="flex justify-between gap-3">
                        <span>
                          {ex.name}
                          {ex.notes && <span className="text-muted-foreground"> — {ex.notes}</span>}
                        </span>
                        {(ex.sets || ex.reps) && (
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {ex.sets ?? "?"}×{ex.reps ?? "?"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {d.cardio && <p className="mt-2 text-sm text-muted-foreground">Cardio: {d.cardio}</p>}
                </div>
              ))}
              {plan.workout?.notes && (
                <p className="text-sm text-muted-foreground">{plan.workout.notes}</p>
              )}
            </CardContent>
          </Card>

          {plan.generated_at && (
            <p className="text-center text-xs text-muted-foreground">
              Generated {format(parseISO(plan.generated_at), "MMM d, h:mm a")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
