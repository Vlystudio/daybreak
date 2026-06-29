"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONFIDENCE_DISPLAY } from "@/components/health/health-display";
import type { Confidence } from "@/lib/health/types";

/**
 * Compact confidence chip. When `reasons` are provided it becomes a tappable
 * popover that explains, in plain language, why Daybreak is more or less sure —
 * progressive disclosure instead of a wall of caveats.
 */
export function ConfidenceBadge({
  confidence,
  reasons,
  className,
}: {
  confidence: Confidence;
  reasons?: string[];
  className?: string;
}) {
  const { label, variant } = CONFIDENCE_DISPLAY[confidence];

  if (!reasons || reasons.length === 0) {
    return (
      <Badge variant={variant} className={className}>
        {label}
      </Badge>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none",
            className
          )}
          aria-label={`${label} — why?`}
        >
          <Badge variant={variant} className="cursor-pointer">
            {label}
            <Info className="h-3 w-3 opacity-70" aria-hidden />
          </Badge>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={12}
          className="border-border bg-card text-card-foreground shadow-lifted data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 w-64 rounded-xl border p-3 text-xs"
        >
          <p className="mb-1.5 font-medium">Why {label.toLowerCase()}?</p>
          <ul className="text-muted-foreground space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden>·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <Popover.Arrow className="fill-card" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
