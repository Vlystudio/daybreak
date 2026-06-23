"use client";

import { useEffect, useState, useTransition } from "react";
import { Mail, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setMorningEmailEnabled } from "@/actions/settings";
import { savePushSubscription, deletePushSubscription } from "@/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function NotificationsCard({ morningEmailEnabled }: { morningEmailEnabled: boolean }) {
  const [emailEnabled, setEmailEnabled] = useState(morningEmailEnabled);
  const [pending, startTransition] = useTransition();

  function toggleEmail(next: boolean) {
    setEmailEnabled(next);
    startTransition(async () => {
      const result = await setMorningEmailEnabled({ enabled: next });
      if (result.ok) toast.success(next ? "Morning briefing email on." : "Morning briefing email off.");
      else {
        setEmailEnabled(!next);
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
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Morning briefing email</p>
            <p className="text-xs text-muted-foreground">
              Get your daily briefing in your inbox each morning, the moment it&apos;s ready.
            </p>
          </div>
          <Switch
            checked={emailEnabled}
            disabled={pending}
            aria-label="Morning briefing email"
            onCheckedChange={toggleEmail}
          />
        </div>

        {VAPID_PUBLIC_KEY && <PushRow />}
      </CardContent>
    </Card>
  );
}

function PushRow() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setSupported(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(sub));
      } catch {
        // ignore — leave defaults
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (result.ok) {
        setSubscribed(true);
        toast.success("Push notifications on.");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Couldn't enable push on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push notifications off.");
    } catch {
      toast.error("Couldn't turn off push.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <BellRing className="h-3.5 w-3.5 text-honey" aria-hidden />
          Push notifications
        </p>
        <p className="text-xs text-muted-foreground">
          A nudge on this device when your briefing and plan are ready.
        </p>
      </div>
      <Switch
        checked={subscribed}
        disabled={busy}
        aria-label="Push notifications"
        onCheckedChange={(v) => (v ? enable() : disable())}
      />
    </div>
  );
}

/** Convert a base64url VAPID key to the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
