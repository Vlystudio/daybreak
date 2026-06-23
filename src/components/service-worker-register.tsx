"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on load so push notifications and the share
 * target work. Safe no-op where service workers aren't supported.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore — the app works without it
    });
  }, []);
  return null;
}
