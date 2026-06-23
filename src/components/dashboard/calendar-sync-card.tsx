"use client";

import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Link2, Unlink, Activity, CalendarCheck, Watch } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { setCalendarSyncEnabled, disconnectProvider, syncNow } from "@/actions/settings";
import type { Connection, CalendarSyncSettings } from "@/lib/types";

export function CalendarSyncCard({
  connections,
  calendarSync,
  fitbitAvailable = false,
}: {
  connections: Connection[];
  calendarSync: CalendarSyncSettings | null;
  fitbitAvailable?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const ouraConnected = connections.some((c) => c.provider === "oura");
  const googleConnected = connections.some((c) => c.provider === "google");
  const fitbitConnected = connections.some((c) => c.provider === "fitbit");
  const syncEnabled = calendarSync?.sync_enabled ?? true;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" aria-hidden />
          Connections
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || (!ouraConnected && !googleConnected)}
          onClick={() => run(syncNow, "Everything is up to date.")}
        >
          <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
          Sync now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {/* Oura */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-soft">
              <Activity className="h-4 w-4 text-sage" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Oura Ring</p>
              <p className="text-xs text-muted-foreground">
                {ouraConnected ? "Connected — syncs every morning" : "Sleep, readiness & HRV"}
              </p>
            </div>
          </div>
          {ouraConnected ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => disconnectProvider("oura"), "Oura disconnected.")}
            >
              <Unlink aria-hidden />
              <span className="sr-only">Disconnect Oura</span>
            </Button>
          ) : (
            <Button size="sm" asChild>
              {/* Full page navigation (not a Next Link) so the OAuth redirect works */}
              <a href="/api/oauth/oura/start">Connect</a>
            </Button>
          )}
        </div>

        {(fitbitAvailable || fitbitConnected) && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-peach-soft">
                  <Watch className="h-4 w-4 text-peach" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">Fitbit</p>
                  <p className="text-xs text-muted-foreground">
                    {fitbitConnected ? "Connected — syncs every morning" : "Sleep, heart rate & activity"}
                  </p>
                </div>
              </div>
              {fitbitConnected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => disconnectProvider("fitbit"), "Fitbit disconnected.")}
                >
                  <Unlink aria-hidden />
                  <span className="sr-only">Disconnect Fitbit</span>
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <a href="/api/oauth/fitbit/start">Connect</a>
                </Button>
              )}
            </div>
          </>
        )}

        <Separator />

        {/* Google Calendar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-soft">
              <CalendarCheck className="h-4 w-4 text-sky" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">
                {googleConnected
                  ? calendarSync?.last_synced_at
                    ? `Synced ${formatDistanceToNow(new Date(calendarSync.last_synced_at), { addSuffix: true })}`
                    : "Connected"
                  : "See your day alongside your health"}
              </p>
            </div>
          </div>
          {googleConnected ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={syncEnabled}
                disabled={pending}
                aria-label="Calendar sync enabled"
                onCheckedChange={(v) =>
                  run(
                    () => setCalendarSyncEnabled({ syncEnabled: v }),
                    v ? "Calendar sync on." : "Calendar sync paused."
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => disconnectProvider("google"), "Google Calendar disconnected.")}
              >
                <Unlink aria-hidden />
                <span className="sr-only">Disconnect Google Calendar</span>
              </Button>
            </div>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/oauth/google/start">Connect</a>
            </Button>
          )}
        </div>

        {googleConnected &&
          (calendarSync?.daybreak_calendar_id ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              ↪ Two-way sync on — your Daybreak plan is written to a “Daybreak” calendar in Google.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Enable two-way sync — let Daybreak push your plan into Google Calendar.
              </p>
              <Button size="sm" variant="secondary" asChild>
                {/* Re-runs OAuth with forced consent, overwriting the old read-only grant */}
                <a href="/api/oauth/google/start">Reconnect</a>
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
