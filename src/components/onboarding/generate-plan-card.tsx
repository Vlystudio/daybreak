"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generatePlan } from "@/actions/plan";

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

  return (
    <Card className="bg-sunrise border-none text-[#5a3d1a]">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden /> Smart plan
          </h2>
          <p className="mt-1 max-w-md text-sm opacity-80">
            {ready
              ? "Build your upcoming days — workouts, chores, hobbies, and downtime — around your calendar and recent recovery. Added straight to your schedule."
              : "Answer the questions below and save first, then come back here to generate your plan."}
          </p>
        </div>
        <Button onClick={run} disabled={!ready || pending} className="shrink-0 shadow-soft">
          {pending ? "Planning…" : "Generate my plan"}
        </Button>
      </CardContent>
    </Card>
  );
}
