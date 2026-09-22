"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, Target, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { regenerateBriefing } from "@/actions/settings";
import type { DailySummary } from "@/lib/types";

export function MorningSummary({
  summary,
  eventCount = 0,
  habitCount = 0,
  canGenerate = false,
}: {
  summary: DailySummary | null;
  eventCount?: number;
  habitCount?: number;
  canGenerate?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateBriefing();
      if (result.ok) toast.success("Your briefing is fresh out of the oven.");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="glass border-none">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <Badge variant="honey" className="mb-3">
            <Sparkles className="h-3 w-3" aria-hidden />
            {summary ? "Morning briefing" : "Your morning"}
          </Badge>
          {canGenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={regenerate}
              disabled={pending}
              aria-label="Regenerate briefing"
            >
              <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
              <span className="hidden sm:inline">{pending ? "Thinking…" : "Refresh"}</span>
            </Button>
          )}
        </div>

        {summary ? (
          <>
            <p className="text-lg leading-relaxed sm:text-xl">{summary.summary}</p>

            {summary.focus && (
              <div className="bg-honey-soft mt-5 flex items-start gap-3 rounded-2xl p-4">
                <Target className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-[#9a6b1f]">Today&apos;s focus</p>
                  <p className="text-sm">{summary.focus}</p>
                </div>
              </div>
            )}

            {summary.insights.length > 0 && (
              <ul className="mt-5 space-y-2" aria-label="Health insights">
                {summary.insights.map((insight, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2.5 text-sm">
                    <Lightbulb className="text-honey mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {insight}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-lg leading-relaxed">
              {eventCount > 0
                ? `You have ${eventCount} scheduled ${eventCount === 1 ? "block" : "blocks"} today. Start with a quick check-in, then make room for what matters.`
                : "Start with how you feel. Add one thing you want to make time for today."}
            </p>
            {habitCount > 0 && (
              <p className="text-muted-foreground text-sm">
                Your {habitCount === 1 ? "habit is" : `${habitCount} habits are`} ready below. Small
                steps count.
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/schedule"
                className="text-primary font-medium underline underline-offset-4"
              >
                View your schedule
              </Link>
              {!canGenerate && (
                <Link
                  href="/settings#ai-data-use"
                  className="text-muted-foreground underline underline-offset-4"
                >
                  Optional AI briefing settings
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
