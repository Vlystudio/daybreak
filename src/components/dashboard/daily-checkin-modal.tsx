"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CheckinCard } from "@/components/dashboard/checkin-card";
import type { SubjectiveCheckin } from "@/lib/types";

/**
 * Prompts the daily check-in the first time the app is opened each day. If the
 * user dismisses it (or has already checked in), it stays out of the way — the
 * check-in remains available from its card on the dashboard.
 */
export function DailyCheckinModal({ checkin }: { checkin: SubjectiveCheckin | null }) {
  const [open, setOpen] = useState(false);
  const done = Boolean(checkin);

  useEffect(() => {
    if (done) return;
    const today = new Date().toLocaleDateString("en-CA");
    try {
      if (localStorage.getItem(`daybreak-checkin-seen-${today}`)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 500); // let the page settle first
    return () => clearTimeout(t);
  }, [done]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(`daybreak-checkin-seen-${new Date().toLocaleDateString("en-CA")}`, "1");
    } catch {
      // ignore
    }
  }

  if (!open || done) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="drawer-overlay absolute inset-0 bg-black/40" onClick={dismiss} aria-hidden />
      <div className="drawer-panel relative w-full max-w-sm">
        <div className="mb-2 text-center">
          <p className="text-lg font-semibold text-white drop-shadow">Good to see you 👋</p>
          <p className="text-sm text-white/90 drop-shadow">Take a few seconds to check in with yourself.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Maybe later"
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <CheckinCard checkin={checkin} />
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mx-auto mt-3 block text-sm font-medium text-white/90 underline-offset-2 hover:underline drop-shadow"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
