"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, RefreshCw, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { regenerateBriefing } from "@/actions/settings";
import type { DailySummary } from "@/lib/types";

export function MorningSummary({
  summary,
  eventCount = 0,
  habitCount = 0,
  canGenerate = false,
  checkedIn = false,
}: {
  summary: DailySummary | null;
  eventCount?: number;
  habitCount?: number;
  canGenerate?: boolean;
  checkedIn?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function regenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateBriefing();
        if (result.ok) toast.success("Your briefing is updated.");
        else setError(result.error ?? "Couldn't refresh your briefing.");
      } catch {
        setError(
          "Couldn't connect. Your previous briefing is still here. Try again when you're online."
        );
      }
    });
  }
  return (
    <section className="today-hero" aria-labelledby="today-focus-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2">
          <Sunrise className="text-primary h-4 w-4" aria-hidden /> A little room for you
        </p>
        {checkedIn && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Check className="h-3.5 w-3.5" aria-hidden /> Checked in
          </span>
        )}
      </div>
      <h2 id="today-focus-title">
        {checkedIn ? "Make today your own." : "A good day starts with you."}
      </h2>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        {checkedIn
          ? "Your check-in is saved. See what’s ahead and make space for what matters."
          : "Take a moment to check in, then shape the day around how you feel."}
      </p>
      <div className="my-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="text-primary h-4 w-4" aria-hidden />
          {eventCount} {eventCount === 1 ? "plan" : "plans"} today
        </span>
        {habitCount > 0 && (
          <span className="text-muted-foreground">
            {habitCount} daily {habitCount === 1 ? "habit" : "habits"}
          </span>
        )}
      </div>
      <Button asChild className="w-full sm:w-auto">
        {checkedIn ? (
          <Link href="/schedule">
            See today’s schedule <ArrowUpRight aria-hidden />
          </Link>
        ) : (
          <a href="#daily-check-in">
            Check in with yourself <ArrowUpRight aria-hidden />
          </a>
        )}
      </Button>
      {(summary || canGenerate) && (
        <details className="border-border mt-4 border-t pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Your personal briefing
          </summary>
          <div className="space-y-3 pb-1 text-sm leading-relaxed">
            {summary && (
              <>
                <p>{summary.summary}</p>
                {summary.focus && (
                  <p>
                    <strong>Today’s focus:</strong> {summary.focus}
                  </p>
                )}
                {summary.insights.length > 0 && (
                  <ul className="text-muted-foreground list-disc space-y-2 pl-5">
                    {summary.insights.map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {canGenerate && (
              <Button variant="outline" size="sm" onClick={regenerate} disabled={pending}>
                <RefreshCw className={pending ? "animate-spin" : ""} aria-hidden />
                {pending ? "Refreshing…" : summary ? "Refresh briefing" : "Create briefing"}
              </Button>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
