"use client";

import { useState, useTransition } from "react";
import { HeartPulse, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logSubjectiveCheckin } from "@/actions/checkin";
import type { SubjectiveCheckin } from "@/lib/types";

type Metric = "mood" | "energy" | "stress" | "soreness";

const METRICS: { key: Metric; label: string; low: string; high: string }[] = [
  { key: "mood", label: "Mood", low: "Low", high: "Great" },
  { key: "energy", label: "Energy", low: "Drained", high: "Charged" },
  { key: "stress", label: "Stress", low: "Calm", high: "Frazzled" },
  { key: "soreness", label: "Soreness", low: "Fresh", high: "Aching" },
];

export function CheckinCard({ checkin }: { checkin: SubjectiveCheckin | null }) {
  const [values, setValues] = useState<Record<Metric, number | null>>({
    mood: checkin?.mood ?? null,
    energy: checkin?.energy ?? null,
    stress: checkin?.stress ?? null,
    soreness: checkin?.soreness ?? null,
  });
  const [pending, startTransition] = useTransition();
  const logged = Boolean(checkin);

  function save() {
    startTransition(async () => {
      const result = await logSubjectiveCheckin({ ...values });
      if (result.ok) toast.success("Checked in — thanks for sharing.");
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  const anySet = Object.values(values).some((v) => v != null);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4 text-peach" aria-hidden />
          How are you feeling?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-6">
        {METRICS.map((m) => (
          <div key={m.key}>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.label}</span>
              <span>
                {m.low} · {m.high}
              </span>
            </div>
            <div className="flex gap-1.5" role="group" aria-label={m.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${m.label} ${n} of 5`}
                  aria-pressed={values[m.key] === n}
                  onClick={() => setValues((v) => ({ ...v, [m.key]: v[m.key] === n ? null : n }))}
                  className={cn(
                    "h-8 flex-1 rounded-lg border text-sm font-medium transition-colors",
                    values[m.key] === n
                      ? "border-peach bg-peach-soft text-[#8a4b2f]"
                      : "border-border bg-background text-muted-foreground hover:border-peach/50"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button onClick={save} disabled={pending || !anySet} size="sm" className="w-full">
          {logged ? <Check aria-hidden /> : null}
          {pending ? "Saving…" : logged ? "Update check-in" : "Log check-in"}
        </Button>
      </CardContent>
    </Card>
  );
}
