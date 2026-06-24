import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationsAvailable } from "@/env";
import { sendPushToUser } from "@/lib/push";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { ReminderKind } from "@/lib/types";

/**
 * Reminder dispatch, called hourly by the data-sync cron. Each enabled reminder
 * fires once per local day at its chosen hour, delivered by push. Hour matching
 * uses the user's timezone; last_sent_on guards against duplicates.
 */

export const REMINDER_PRESETS: Record<ReminderKind, { label: string; title: string; body: string; url: string }> = {
  hydration: { label: "Hydration", title: "💧 Hydration", body: "Time for a glass of water.", url: "/nutrition" },
  wind_down: { label: "Wind-down", title: "🌙 Wind-down", body: "Start easing toward bed — screens down, lights low.", url: "/dashboard" },
  move: { label: "Move break", title: "🚶 Move break", body: "Stand up, stretch, or take a short walk.", url: "/dashboard" },
  log_food: { label: "Log meals", title: "🍽️ Log your meals", body: "Snap or jot down what you ate today.", url: "/nutrition" },
  checkin: { label: "Check-in", title: "✅ Quick check-in", body: "How are you feeling? Takes 30 seconds.", url: "/dashboard" },
  custom: { label: "Custom", title: "🔔 Daybreak", body: "Reminder.", url: "/dashboard" },
};

function localParts(timeZone: string): { hour: number; date: string } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = parseInt(get("hour"), 10) % 24;
    return { hour, date: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), date: now.toISOString().slice(0, 10) };
  }
}

interface ReminderRow {
  id: string;
  user_id: string;
  kind: ReminderKind;
  hour: number;
  message: string | null;
  last_sent_on: string | null;
}

export async function dispatchReminders(): Promise<number> {
  if (!integrationsAvailable.push()) return 0;
  const admin = createAdminClient();

  const { data: reminders } = await admin
    .from("reminders")
    .select("id, user_id, kind, hour, message, last_sent_on")
    .eq("enabled", true)
    .returns<ReminderRow[]>();
  if (!reminders || reminders.length === 0) return 0;

  // Resolve each involved user's timezone once.
  const userIds = [...new Set(reminders.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds)
    .returns<{ id: string; timezone: string | null }[]>();
  const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));

  // Only the reminders due this hour do any work; fan those out concurrently
  // (was sequential) so a busy hour can't serialize into a timeout.
  const results = await mapWithConcurrency(reminders, 10, async (r) => {
    const { hour, date } = localParts(tzById.get(r.user_id) ?? "UTC");
    if (hour !== r.hour) return false;
    if (r.last_sent_on === date) return false;

    const preset = REMINDER_PRESETS[r.kind];
    const body = r.kind === "custom" && r.message ? r.message : r.message || preset.body;
    const delivered = await sendPushToUser(r.user_id, { title: preset.title, body, url: preset.url });
    // Mark sent regardless of delivery count so we don't retry every hour.
    await admin.from("reminders").update({ last_sent_on: date }).eq("id", r.id);
    return delivered > 0;
  });

  let sent = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value) sent++;
    } else {
      console.error("[reminders] dispatch failed for one:", r.reason);
    }
  }
  return sent;
}
