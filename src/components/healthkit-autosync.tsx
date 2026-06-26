"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Runs an incremental Apple Health sync on app launch — but only inside the
 * native iOS shell. On web the platform check fails and the heavy HealthKit
 * client chunk is never even loaded. No-op (renders nothing) either way.
 */
export function HealthKitAutoSync() {
  useEffect(() => {
    if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios")) return;
    import("@/lib/integrations/apple-health/healthkit.client")
      .then((m) => m.syncHealthKit())
      .catch(() => {});
  }, []);
  return null;
}
