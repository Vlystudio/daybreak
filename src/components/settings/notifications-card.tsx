"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setMorningEmailEnabled } from "@/actions/settings";

export function NotificationsCard({ morningEmailEnabled }: { morningEmailEnabled: boolean }) {
  const [enabled, setEnabled] = useState(morningEmailEnabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next); // optimistic
    startTransition(async () => {
      const result = await setMorningEmailEnabled({ enabled: next });
      if (result.ok) {
        toast.success(next ? "Morning briefing email on." : "Morning briefing email off.");
      } else {
        setEnabled(!next); // revert
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" aria-hidden />
          Notifications
        </CardTitle>
        <CardDescription>How Daybreak reaches you</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Morning briefing email</p>
            <p className="text-xs text-muted-foreground">
              Get your daily briefing in your inbox each morning, the moment it&apos;s ready.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={pending}
            aria-label="Morning briefing email"
            onCheckedChange={toggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
