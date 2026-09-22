"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Activity, Upload, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseAppleHealthExport } from "@/lib/integrations/apple-health/parse";
import {
  importAppleHealthChunk,
  finalizeAppleHealthImport,
  disconnectAppleHealth,
} from "@/actions/apple-health-import";
import type { AppleHealthChunk } from "@/lib/integrations/apple-health/schema";

/**
 * Apple Health connect row — a peer of Oura/Fitbit in the Connections card.
 *
 * On the native iOS shell it's true one-tap: "Connect" triggers the HealthKit
 * permission sheet and an automatic sync (and keeps syncing on every launch).
 * On the web (no HealthKit access exists in a browser) it falls back to a
 * guided "Export All Health Data" upload, which the browser parses locally.
 */

const CHUNK = 1500;

function batches<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function AppleHealthConnect({
  connected: initialConnected = false,
  lastRangeEnd = null,
}: {
  connected?: boolean;
  lastRangeEnd?: string | null;
}) {
  const [isNative, setIsNative] = useState(false);
  const [connected, setConnected] = useState(initialConnected);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [healthDisclosureOpen, setHealthDisclosureOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [importDays, setImportDays] = useState<90 | 365>(90);
  const [progress, setProgress] = useState<{ label: string; fraction: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Detect the native shell only after mount — doing it during render would
    // diverge from the server-rendered (web) HTML and cause a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNative(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios");
  }, []);

  // ── Native: one-tap connect + sync ─────────────────────────────────────────
  async function nativeSync(authorize: boolean) {
    setBusy(true);
    try {
      const { syncHealthKit } = await import("@/lib/integrations/apple-health/healthkit.client");
      const result = await syncHealthKit({ authorize, importDays });
      if (result.ok) {
        setConnected(true);
        toast.success(
          authorize
            ? `Connected — imported ${result.days} day${result.days === 1 ? "" : "s"} of Health data.`
            : "Apple Health is up to date."
        );
      } else if (result.reason === "denied") {
        toast.error("Permission denied. Enable Daybreak in Settings → Privacy → Health.");
      } else if (result.reason === "not-native") {
        toast.error("Open Daybreak in the iPhone app to connect Apple Health.");
      } else if (result.reason === "not-connected") {
        toast.error("Connect Apple Health before syncing.");
      } else {
        toast.error(result.error ?? "Couldn't sync Apple Health.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(removeData: boolean) {
    setBusy(true);
    try {
      const result = await disconnectAppleHealth({ deleteData: removeData });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { clearHealthKitLocalState } =
        await import("@/lib/integrations/apple-health/healthkit.client");
      await clearHealthKitLocalState();
      setConnected(false);
      setDisconnectOpen(false);
      toast.success(
        removeData
          ? "Apple Health disconnected and imported data removed."
          : "Apple Health disconnected."
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Web: guided export upload ───────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      setProgress({ label: "Reading export…", fraction: 0 });
      const result = await parseAppleHealthExport(file, (f) =>
        setProgress({ label: "Reading export…", fraction: f * 0.5 })
      );
      const total = result.metrics.length + result.workouts.length + result.samples.length;
      if (total === 0) {
        toast.error("No recognizable health data found in that export.");
        return;
      }
      const calls: AppleHealthChunk[] = [
        ...batches(result.metrics, CHUNK).map((metrics) => ({ metrics })),
        ...batches(result.workouts, CHUNK).map((workouts) => ({ workouts })),
        ...batches(result.samples, CHUNK).map((samples) => ({ samples })),
      ];
      let done = 0;
      for (const call of calls) {
        const res = await importAppleHealthChunk(call);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        done++;
        setProgress({ label: "Saving to Daybreak…", fraction: 0.5 + (done / calls.length) * 0.5 });
      }
      await finalizeAppleHealthImport({
        fileName: file.name,
        source: "file",
        rangeStart: result.rangeStart,
        rangeEnd: result.rangeEnd,
        metricsDays: result.metrics.length,
        workouts: result.workouts.length,
        samples: result.samples.length,
      });
      setConnected(true);
      setDialogOpen(false);
      const days = result.metrics.length;
      toast.success(
        `Imported ${days} day${days === 1 ? "" : "s"} of metrics` +
          (result.workouts.length ? `, ${result.workouts.length} workouts` : "") +
          (result.truncatedSamples ? " (older detail samples were trimmed)" : "") +
          "."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that export.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const subtitle = connected
    ? isNative
      ? "Connected — syncs automatically"
      : lastRangeEnd
        ? `Connected — imported through ${lastRangeEnd}`
        : "Connected"
    : "Sleep, heart, activity & workouts";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-honey-soft flex h-9 w-9 items-center justify-center rounded-full">
          <Activity className="text-honey h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium">Apple Health</p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      {isNative ? (
        connected ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => nativeSync(false)}>
              <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden />
              Sync now
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label="Disconnect Apple Health"
              onClick={() => setDisconnectOpen(true)}
            >
              <Unplug aria-hidden />
            </Button>
          </div>
        ) : (
          <Button
            id="apple-health-connect"
            data-testid="apple-health-connect"
            size="sm"
            disabled={busy}
            onClick={() => setHealthDisclosureOpen(true)}
          >
            {busy ? "Connecting…" : "Connect"}
          </Button>
        )
      ) : (
        <Button
          size="sm"
          variant={connected ? "ghost" : "default"}
          onClick={() => setDialogOpen(true)}
        >
          {connected ? "Update" : "Connect"}
        </Button>
      )}

      <Dialog
        open={healthDisclosureOpen}
        onOpenChange={(open) => !busy && setHealthDisclosureOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Apple Health</DialogTitle>
            <DialogDescription>
              Daybreak requests read-only access after you continue. It never writes to Apple
              Health.
            </DialogDescription>
          </DialogHeader>
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              Daybreak reads sleep, steps, walking distance, active and basal energy, HRV, resting
              heart rate, respiratory rate, oxygen saturation, workouts, exercise time, weight, body
              fat, and VO₂ max to show wellness trends and tailor planning.
            </p>
            <p>
              Imported summaries are uploaded to Daybreak’s Supabase backend. Sending health context
              to OpenAI is controlled by a separate optional consent in AI data use; connecting
              Apple Health does not enable it.
            </p>
            <p>
              You can revoke access in iOS Settings and disconnect or delete imported Apple Health
              data here at any time.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-foreground font-medium">Initial import range</legend>
              {[90, 365].map((days) => (
                <label key={days} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="health-import-range"
                    checked={importDays === days}
                    onChange={() => setImportDays(days as 90 | 365)}
                  />
                  {days === 90 ? "Last 90 days (recommended)" : "Last year"}
                </label>
              ))}
            </fieldset>
          </div>
          <Button
            data-testid="apple-health-authorize"
            id="apple-health-authorize"
            disabled={busy}
            onClick={async () => {
              await nativeSync(true);
              setHealthDisclosureOpen(false);
            }}
          >
            {busy ? "Connecting…" : "Continue to Apple Health"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={disconnectOpen} onOpenChange={(open) => !busy && setDisconnectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Apple Health?</DialogTitle>
            <DialogDescription>
              Future synchronization will stop and the local sync marker will be removed. You can
              also revoke Health permission in iOS Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => disconnect(true)}>
              Disconnect and delete Apple Health data
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => disconnect(false)}>
              Disconnect and keep imported data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(o) => !busy && setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from Apple Health</DialogTitle>
            <DialogDescription>
              A browser can&apos;t read Apple Health directly, so export your data once and upload
              it here. For automatic syncing, install the Daybreak iPhone app.
            </DialogDescription>
          </DialogHeader>

          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            <li>Open the Health app and tap your profile picture (top-right).</li>
            <li>
              Scroll down and tap <span className="font-medium">Export All Health Data</span>.
            </li>
            <li>
              Save the <span className="font-medium">export.zip</span> to this device, then upload
              it below.
            </li>
          </ol>

          <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={onFile} />
          <Button disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden />
            {busy ? "Importing…" : "Upload export.zip"}
          </Button>

          {progress && (
            <div className="space-y-1" aria-live="polite">
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">{progress.label}</p>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Everything is parsed on your device; only daily summaries are sent to Daybreak.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
