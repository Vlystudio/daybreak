"use client";

import { Capacitor } from "@capacitor/core";

/** Enhancement only: existing TestFlight shells without this plugin remain usable. */
export async function feedback(kind: "selection" | "success" = "selection"): Promise<void> {
  if (
    typeof window === "undefined" ||
    !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable("Haptics") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Hardware feedback must never interrupt an action or produce a user-facing error.
  }
}
