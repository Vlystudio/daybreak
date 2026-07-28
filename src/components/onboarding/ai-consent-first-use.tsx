"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { setAiConsentPreferences } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_AI_CONSENT, type AiConsent } from "@/lib/integrations/ai-consent";

const OPTIONS: Array<{ key: keyof AiConsent; label: string; description: string }> = [
  {
    key: "basic",
    label: "Basic AI processing",
    description: "Your direct prompt or feature request, required before any external AI call.",
  },
  {
    key: "tasks",
    label: "Tasks and plan context",
    description: "Planning dates, task context, workouts, and meal-plan constraints.",
  },
  {
    key: "checkin",
    label: "Daily check-ins",
    description: "Ratings, reflections, and notes about how you feel.",
  },
  {
    key: "health",
    label: "Health and wearable summaries",
    description: "Sleep, HRV, recovery, activity, and wellness trends.",
  },
  {
    key: "calendarAvailability",
    label: "Calendar availability",
    description: "Start/end times with neutral Busy time labels so plans avoid conflicts.",
  },
  {
    key: "calendarDetail",
    label: "Detailed calendar text",
    description: "Event titles and descriptions. Requires Calendar availability.",
  },
  {
    key: "profile",
    label: "Profile and preferences",
    description: "Name, routines, goals, equipment, dietary preferences, and local weather.",
  },
  {
    key: "uploads",
    label: "Uploaded photos",
    description: "Meal or receipt images only when you deliberately choose Analyze.",
  },
];

export function AiConsentFirstUse() {
  const router = useRouter();
  const [consent, setConsent] = useState<AiConsent>(DEFAULT_AI_CONSENT);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setAiConsentPreferences(consent);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your AI data choices are saved.");
      router.refresh();
    });
  }

  function setChoice(key: keyof AiConsent, enabled: boolean) {
    setConsent((current) => {
      const next = { ...current, [key]: enabled };
      if (key === "calendarAvailability" && !enabled) next.calendarDetail = false;
      if (key === "calendarDetail" && enabled) next.calendarAvailability = true;
      return next;
    });
  }

  return (
    <Card className="border-primary/30" aria-labelledby="ai-consent-title">
      <CardHeader>
        <CardTitle id="ai-consent-title" className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" aria-hidden />
          Choose what AI can use
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            Daybreak uses OpenAI as an external AI processor for briefings, coaching, and plans;
            LogMeal may process a meal photo when configured. Choose each category that may leave
            Daybreak for a feature you start.
          </span>
          <span className="block">
            Declining is allowed and non-AI features remain available. AI output may be inaccurate
            and is wellness guidance—not diagnosis or medical advice. Revoke any choice in Settings;
            existing permits are invalidated immediately.
          </span>
          <span className="block">
            Daybreak does not retain meal or receipt images after analysis. Providers may retain
            limited API data under configured abuse-monitoring and service terms; Daybreak does not
            permit advertising or model training with health data.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {OPTIONS.map((option) => (
          <div key={option.key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-muted-foreground text-xs">{option.description}</p>
            </div>
            <Switch
              checked={consent[option.key]}
              disabled={pending}
              aria-label={`Allow ${option.label.toLowerCase()} to be sent to an AI provider`}
              onCheckedChange={(enabled) => setChoice(option.key, enabled)}
            />
          </div>
        ))}
        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? "Saving choices…" : "Save choices and continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
