"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { zonedToUtc, localToday } from "@/lib/tz";
import { computeHeadsUp } from "@/lib/health-insights";
import {
  analyzeFusedHealth,
  healthCheckinReply,
  type HealthAnalysis,
  type CheckinTurn,
  type CheckinAction,
} from "@/lib/integrations/ai";
import { buildDailyHealthUnderstanding } from "@/lib/health/understanding";
import { buildAiHealthInput } from "@/lib/health/ai-input";
import type { HealthMetric } from "@/lib/types";
import type { ActionResult } from "@/actions/schedule";
import { AI_CONSENT_REQUIRED_ERROR, getAiProcessingPermit } from "@/lib/integrations/ai-permit";

export type AnalyzeResult = { ok: true; analysis: HealthAnalysis } | { ok: false; error: string };

export interface CheckinMessage {
  role: "assistant" | "user";
  content: string;
  at: string;
  action?: CheckinAction | null;
}
export type CheckinResult =
  | { ok: true; id: string; messages: CheckinMessage[] }
  | { ok: false; error: string };

const METRIC_COLUMNS =
  "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, body_temperature_delta, steps, active_calories, activity_score, spo2_avg, respiratory_rate, stress_high_min, recovery_high_min, resilience_level";

/**
 * On-demand AI read of the user's health. Builds the deterministic, source-aware
 * understanding first (fused signals, confidence, baselines, source conflicts),
 * then hands ONLY that cleaned summary to the AI to explain — never raw,
 * multi-source rows. Tightly rate-limited.
 */
export async function analyzeHealth(): Promise<AnalyzeResult> {
  const user = await requireUser();
  const permit = await getAiProcessingPermit(user.id);
  if (!permit) return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  if (!permit.consent.health) {
    return {
      ok: false,
      error: "Enable Health and wearable summaries under Settings → AI data use first.",
    };
  }

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "Analysis limit reached for now — try again a little later." };
  }

  // 90 days so personal baselines are meaningful.
  const understanding = await buildDailyHealthUnderstanding(
    user.id,
    new Date(Date.now() - 90 * 86_400_000),
    new Date()
  );

  const maxDays = Math.max(0, ...understanding.baselines.map((b) => b.sampleCount));
  if (maxDays < 3) {
    return { ok: false, error: "Not enough data yet — give your tracker a few more days to sync." };
  }

  const aiInput = buildAiHealthInput(understanding) as unknown as Record<string, unknown>;
  const analysis = await analyzeFusedHealth(permit, aiInput);
  if (!analysis) {
    return { ok: false, error: "Couldn't analyze your trends right now — please try again." };
  }

  await audit(user.id, "health.analyzed", {
    metadata: { days: maxDays, sources: understanding.dataQuality.connectedSources.length },
  });
  return { ok: true, analysis };
}

async function recentMetricsAndFlags(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("health_metrics")
    .select(METRIC_COLUMNS)
    .eq("user_id", userId)
    .gte("date", since)
    .order("date", { ascending: true })
    .returns<HealthMetric[]>();
  const rows = data ?? [];
  return { rows, flags: computeHeadsUp(rows).map((f) => ({ title: f.title, detail: f.detail })) };
}

/** Start a check-in: the coach opens with a pointed question from your data. */
export async function startCheckin(): Promise<CheckinResult> {
  const user = await requireUser();
  const permit = await getAiProcessingPermit(user.id);
  if (!permit) return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  if (!permit.consent.health) {
    return {
      ok: false,
      error: "Enable Health and wearable summaries under Settings → AI data use first.",
    };
  }
  const limited = await rateLimit(`chat:${user.id}`, RATE_LIMITS.aiChat);
  if (!limited.ok) return { ok: false, error: "Check-in limit reached for now — try again later." };

  const supabase = await createClient();
  const { rows, flags } = await recentMetricsAndFlags(supabase, user.id);
  if (rows.length < 3)
    return { ok: false, error: "Not enough data yet — give Oura a few more nights to sync." };

  const reply = await healthCheckinReply(permit, {
    metrics: rows as unknown as Record<string, unknown>[],
    flags,
    history: [],
  });
  if (!reply)
    return { ok: false, error: "Couldn't start a check-in right now — please try again." };

  const messages: CheckinMessage[] = [
    {
      role: "assistant",
      content: reply.message,
      at: new Date().toISOString(),
      action: reply.action,
    },
  ];
  const { data, error } = await supabase
    .from("health_checkins")
    .insert({ user_id: user.id, messages })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: "Couldn't save the check-in." };

  await audit(user.id, "health.analyzed", { metadata: { kind: "checkin" } });
  return { ok: true, id: data.id, messages };
}

/** Continue a check-in: append the user's message and get the coach's reply. */
export async function replyCheckin(id: string, message: string): Promise<CheckinResult> {
  const user = await requireUser();
  const permit = await getAiProcessingPermit(user.id);
  if (!permit) return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  if (!permit.consent.checkin) {
    return {
      ok: false,
      error: "Enable Daily check-in ratings and notes under Settings → AI data use first.",
    };
  }
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid check-in" };
  const text = String(message ?? "")
    .trim()
    .slice(0, 1000);
  if (!text) return { ok: false, error: "Type a message first." };

  const limited = await rateLimit(`chat:${user.id}`, RATE_LIMITS.aiChat);
  if (!limited.ok) return { ok: false, error: "Check-in limit reached for now — try again later." };

  const supabase = await createClient();
  const { data: checkin } = await supabase
    .from("health_checkins")
    .select("messages")
    .eq("id", id)
    .maybeSingle<{ messages: CheckinMessage[] }>();
  if (!checkin) return { ok: false, error: "Check-in not found." };

  const history: CheckinMessage[] = [
    ...(checkin.messages ?? []),
    { role: "user", content: text, at: new Date().toISOString() },
  ];

  const { rows, flags } = await recentMetricsAndFlags(supabase, user.id);
  const reply = await healthCheckinReply(permit, {
    metrics: permit.consent.health ? (rows as unknown as Record<string, unknown>[]) : [],
    flags: permit.consent.health ? flags : [],
    history: history.map((m): CheckinTurn => ({ role: m.role, content: m.content })),
  });
  if (!reply) return { ok: false, error: "Couldn't get a reply right now — please try again." };

  const messages: CheckinMessage[] = [
    ...history,
    {
      role: "assistant",
      content: reply.message,
      at: new Date().toISOString(),
      action: reply.action,
    },
  ];
  const { error } = await supabase.from("health_checkins").update({ messages }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save your reply." };

  return { ok: true, id, messages };
}

/** Add an agreed-upon habit from a check-in onto the schedule for the next week. */
export async function scheduleCheckinAction(action: CheckinAction): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const title = String(action?.title ?? "")
    .trim()
    .slice(0, 120);
  const time = action?.time;
  if (!title || typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { ok: false, error: "That action can't be scheduled." };
  }
  const durationMin = Math.min(180, Math.max(5, Math.round(Number(action.durationMin) || 30)));
  const days = Array.isArray(action.daysOfWeek)
    ? action.daysOfWeek.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone || "UTC";
  const todayStr = localToday(tz);

  const rows: {
    user_id: string;
    title: string;
    description: string;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    source: string;
    color: string;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = format(addDays(parseISO(todayStr), i), "yyyy-MM-dd");
    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    if (days.length > 0 && !days.includes(dow)) continue;
    const start = zonedToUtc(dateStr, time, tz);
    rows.push({
      user_id: user.id,
      title,
      description: "From your health check-in",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + durationMin * 60_000).toISOString(),
      all_day: false,
      source: "manual",
      color: "sage",
    });
  }
  if (rows.length === 0) return { ok: false, error: "Nothing to schedule." };

  const { error } = await supabase.from("schedule_events").insert(rows);
  if (error) return { ok: false, error: "Couldn't add it to your schedule." };

  await audit(user.id, "schedule.created", { metadata: { from: "checkin", count: rows.length } });
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}
