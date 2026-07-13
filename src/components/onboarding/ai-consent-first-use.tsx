"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { setAiConsentPreferences } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { AiConsent } from "@/lib/integrations/ai-consent";

const OPTIONS: Array<{ key: keyof AiConsent; label: string; description: string }> = [
  {
    key: "health",
    label: "Health and wearable summaries",
    description:
      "Helps tailor activity and recovery suggestions to sleep, HRV, and wellness trends.",
  },
  {
    key: "calendar",
    label: "Calendar event titles",
    description:
      "Helps make plans fit the purpose of events. Without this, OpenAI sees only “Busy time.”",
  },
  {
    key: "checkin",
    label: "Daily check-in ratings and notes",
    description: "Helps the plan reflect how you say you feel, including any note you wrote.",
  },
];

export function AiConsentFirstUse() {
  const router = useRouter();
  const [consent, setConsent] = useState<AiConsent>({
    health: false,
    calendar: false,
    checkin: false,
  });
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

  return (
    <Card className="border-primary/30" aria-labelledby="ai-consent-title">
      <CardHeader>
        <CardTitle id="ai-consent-title" className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" aria-hidden />
          Choose what AI can use
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            Daybreak uses OpenAI as an external AI processor to create briefings and plans. Choose
            which optional personal-data categories may be sent before you use an AI feature.
          </span>
          <span className="block">
            Declining is allowed. Daybreak still works and can make a more general plan. AI output
            is wellness guidance—not diagnosis or medical advice. You can change or revoke each
            choice later in Settings.
          </span>
          <span className="block">
            Photos or preferences are sent to an AI provider only after you deliberately use the
            related analyze or generate feature; images are processed transiently and not retained.
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
              aria-label={`Allow ${option.label.toLowerCase()} to be sent to OpenAI`}
              onCheckedChange={(enabled) =>
                setConsent((current) => ({ ...current, [option.key]: enabled }))
              }
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
