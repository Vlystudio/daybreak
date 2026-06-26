"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for every authenticated route. A thrown error in a page (or a
 * data fetch it awaits) now renders this friendly fallback instead of a blank
 * screen, with a retry that re-runs the segment. We log the digest/message only
 * — never anything that could carry health data.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[app] route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Something went sideways</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          This page hit a snag on our end. Your data is safe — give it another try.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
