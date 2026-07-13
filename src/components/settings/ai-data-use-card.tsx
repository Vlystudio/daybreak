"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setAiContextPreference } from "@/actions/settings";
import type { AiConsent } from "@/lib/integrations/ai-consent";

/**
 * Transparent, opt-out controls for what Daybreak sends to its AI processor
 * (OpenAI) when writing the morning briefing and daily plan. Apple-review
 * friendly: clear about what is sent, why, and what is never done with it.
 */

const ROWS: { key: keyof AiConsent; label: string; desc: string }[] = [
  {
    key: "health",
    label: "Health & wearable data",
    desc: "Sleep, recovery, HRV and activity summaries",
  },
  {
    key: "checkin",
    label: "Daily check-in notes",
    desc: "Your free-text notes about how you feel",
  },
  {
    key: "calendar",
    label: "Calendar details",
    desc: "Event titles — busy times are always used to avoid clashes",
  },
];

export function AiDataUseCard({
  consent,
  updatedAt,
}: {
  consent: AiConsent;
  updatedAt: string | null;
}) {
  const [state, setState] = useState<AiConsent>(consent);
  const [pending, startTransition] = useTransition();

  function toggle(context: keyof AiConsent, enabled: boolean) {
    const previous = state[context];
    setState((s) => ({ ...s, [context]: enabled }));
    startTransition(async () => {
      const r = await setAiContextPreference({ context, enabled });
      if (!r.ok) {
        setState((s) => ({ ...s, [context]: previous }));
        toast.error(r.error ?? "Couldn't update that setting.");
      } else {
        toast.success("AI settings updated.");
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
          To write your morning briefing and daily plan, Daybreak sends a short summary of the items
          below to an AI provider (OpenAI). It&apos;s used only to generate your plan — never for
          advertising, never sold, and never to diagnose. Turn any of it off and Daybreak will
          simply make a more general plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-muted-foreground text-xs">{r.desc}</p>
            </div>
            <Switch
              checked={state[r.key]}
              disabled={pending}
              aria-label={`Send ${r.label.toLowerCase()} to AI`}
              onCheckedChange={(v) => toggle(r.key, v)}
            />
          </div>
        ))}
        <p className="text-muted-foreground pt-1 text-xs">
          {updatedAt
            ? `Last changed ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(updatedAt))}. Revocation applies to the next AI request.`
            : "No AI data-sharing consent has been recorded. Every category remains off."}
        </p>
      </CardContent>
    </Card>
  );
}
