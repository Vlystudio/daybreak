"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generatePlan, clearPlan } from "@/actions/plan";

export function GeneratePlanCard({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function clear() {
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
              ? "Build your upcoming days around your work hours, calendar, and recovery. Each morning, today's plan auto-refreshes from your latest Oura sleep/energy and the day's weather."
              : "Answer the questions below and save first, then come back here to generate your plan."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={clear} disabled={!ready || pending} variant="outline">
            Clear
          </Button>
          <Button onClick={run} disabled={!ready || pending} className="shadow-soft">
            {pending ? "Planning…" : "Generate my plan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
