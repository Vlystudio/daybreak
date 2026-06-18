"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generatePlan, generateTodayPlan, clearPlan } from "@/actions/plan";

export function GeneratePlanCard({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await generatePlan();
      if (res.ok) {
        toast.success("Your week is planned — added to your schedule.");
        router.push("/schedule");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function planToday() {
    startTransition(async () => {
      const res = await generateTodayPlan();
      if (res.ok) {
        toast.success("Today's plan is ready.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function clearClick() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    setConfirmingClear(false);
    startTransition(async () => {
      const res = await clearPlan();
      if (res.ok) {
        toast.success("Cleared all planned blocks.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="bg-sunrise border-none text-[#5a3d1a]">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden /> Smart plan
          </h2>
          <p className="mt-1 max-w-md text-sm opacity-80">
            {ready
              ? "Plan today rebuilds just today; Generate my plan builds your whole scope. Either way, today auto-refreshes each morning from your latest Oura sleep/energy and the day's weather."
              : "Answer the questions below and save first, then come back here to generate your plan."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            onClick={clearClick}
            disabled={!ready || pending}
            variant={confirmingClear ? "destructive" : "outline"}
          >
            {confirmingClear ? "Tap to confirm" : "Clear"}
          </Button>
          <Button onClick={planToday} disabled={!ready || pending} variant="secondary">
            Plan today
          </Button>
          <Button onClick={run} disabled={!ready || pending} className="shadow-soft">
            {pending ? "Planning…" : "Generate my plan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
