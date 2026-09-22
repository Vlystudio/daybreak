"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generatePlan, generateTodayPlan, clearPlan } from "@/actions/plan";

export function GeneratePlanCard({
  ready,
  aiAllowed = false,
}: {
  ready: boolean;
  aiAllowed?: boolean;
}) {
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
      <CardContent className="space-y-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden /> Smart plan
          </h2>
          <p className="mt-1 max-w-md text-sm opacity-80">
            {!ready
              ? "Set your daily rhythm to get a suggested plan. You can also add events yourself."
              : !aiAllowed
                ? "AI planning is optional. Review your AI data choices in Settings, or add events yourself."
                : "Make space for your day. Generate suggestions around your routine, then adjust them here. Replanning replaces today's suggested blocks."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ready && aiAllowed ? (
            <Button onClick={planToday} disabled={pending}>
              {pending ? "Planning…" : "Plan today"}
            </Button>
          ) : (
            <Button asChild>
              <Link href={!ready ? "/onboarding" : "/settings#ai-data-use"}>
                {!ready ? "Set up my routine" : "Review AI data choices"}
              </Link>
            </Button>
          )}
          {ready && (
            <Link
              href="/onboarding"
              className="inline-flex min-h-11 items-center text-sm underline"
            >
              Plan preferences
            </Link>
          )}
        </div>
        {ready && (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3">More planning options</summary>
            <p className="mb-3 opacity-80">
              Plan ahead using your saved scope, or remove all AI-planned blocks from your schedule.
            </p>
            <div className="flex flex-wrap gap-2">
              {aiAllowed && (
                <Button onClick={run} disabled={pending} variant="secondary">
                  Plan ahead
                </Button>
              )}
              <Button
                onClick={clearClick}
                disabled={pending}
                variant={confirmingClear ? "destructive" : "outline"}
              >
                {confirmingClear ? "Confirm removal" : "Clear planned blocks"}
              </Button>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
