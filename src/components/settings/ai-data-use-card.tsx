"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setAiContextPreference } from "@/actions/settings";
import type { AiConsent } from "@/lib/integrations/ai-consent";

const ROWS: { key: keyof AiConsent; label: string; desc: string }[] = [
  {
    key: "basic",
    label: "Basic AI processing",
    desc: "Direct feature requests; required for any external AI call",
  },
  { key: "tasks", label: "Tasks & plan context", desc: "Planning, workout, and meal-plan context" },
  { key: "checkin", label: "Daily check-ins", desc: "Ratings, reflections, and free-text notes" },
  {
    key: "health",
    label: "Health & wearable summaries",
    desc: "Sleep, HRV, recovery, and activity summaries",
  },
  {
    key: "calendarAvailability",
    label: "Calendar availability",
    desc: "Times only, labeled Busy time",
  },
  { key: "calendarDetail", label: "Detailed calendar text", desc: "Event titles and descriptions" },
  {
    key: "profile",
    label: "Profile & preferences",
    desc: "Routines, goals, equipment, diet, and local weather",
  },
  {
    key: "uploads",
    label: "Uploaded photos",
    desc: "Meal and receipt images for an Analyze action",
  },
];

export function AiDataUseCard({
  consent,
  updatedAt,
  expiresAt,
}: {
  consent: AiConsent;
  updatedAt: string | null;
  expiresAt: string | null;
}) {
  const [state, setState] = useState<AiConsent>(consent);
  const [pending, startTransition] = useTransition();

  function toggle(context: keyof AiConsent, enabled: boolean) {
    const previous = state;
    const next = { ...state, [context]: enabled };
    if (context === "calendarAvailability" && !enabled) next.calendarDetail = false;
    if (context === "calendarDetail" && enabled) next.calendarAvailability = true;
    setState(next);
    startTransition(async () => {
      const result = await setAiContextPreference({ context, enabled });
      if (!result.ok) {
        setState(previous);
        toast.error(result.error ?? "Couldn't update that setting.");
      } else {
        toast.success(enabled ? "AI permission enabled." : "AI permission revoked immediately.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-honey h-4 w-4" aria-hidden /> AI data use
        </CardTitle>
        <CardDescription>
          OpenAI processes authorized categories only for the feature you start; LogMeal may process
          an authorized meal photo. AI may be inaccurate and is not medical advice. Turning a
          category off invalidates outstanding permits and future retries. Learn more in the{" "}
          <Link href="/legal/ai" className="underline">
            AI disclosure
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-muted-foreground text-xs">{row.desc}</p>
            </div>
            <Switch
              id={`ai-consent-${row.key}`}
              data-testid={`ai-consent-${row.key}`}
              checked={state[row.key]}
              disabled={pending}
              aria-label={`Send ${row.label.toLowerCase()} to an AI provider`}
              onCheckedChange={(value) => toggle(row.key, value)}
            />
          </div>
        ))}
        <p className="text-muted-foreground pt-1 text-xs">
          {updatedAt
            ? `Last changed ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(updatedAt))}. ${expiresAt ? `Review again by ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(expiresAt))}.` : "A new review is required."}`
            : "No AI data-sharing decision has been recorded. Every category remains off."}
        </p>
      </CardContent>
    </Card>
  );
}
