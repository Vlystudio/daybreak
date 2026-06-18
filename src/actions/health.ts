"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { computeHeadsUp } from "@/lib/health-insights";
import {
  analyzeHealthTrends,
  healthCheckinReply,
  type HealthAnalysis,
  type CheckinTurn,
} from "@/lib/integrations/ai";
import type { HealthMetric } from "@/lib/types";

export type AnalyzeResult = { ok: true; analysis: HealthAnalysis } | { ok: false; error: string };

export interface CheckinMessage {
  role: "assistant" | "user";
  content: string;
  at: string;
}
export type CheckinResult =
  | { ok: true; id: string; messages: CheckinMessage[] }
  | { ok: false; error: string };

const METRIC_COLUMNS =
  "date, readiness_score, sleep_score, hrv_avg, resting_hr, sleep_duration_min, sleep_efficiency, deep_sleep_min, rem_sleep_min, light_sleep_min, body_temperature_delta, steps, active_calories, activity_score, spo2_avg, respiratory_rate, stress_high_min, recovery_high_min, resilience_level";

/** On-demand AI read of the last ~30 days of metrics. Tightly rate-limited. */
export async function analyzeHealth(): Promise<AnalyzeResult> {
  const user = await requireUser();

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "Analysis limit reached for now — try again a little later." };
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: metrics } = await supabase
    .from("health_metrics")
    .select(METRIC_COLUMNS)
    .eq("user_id", user.id)
    .gte("date", since)
    .order("date", { ascending: true })
    .returns<HealthMetric[]>();

  const rows = metrics ?? [];
  if (rows.length < 3) {
    return { ok: false, error: "Not enough data yet — give Oura a few more nights to sync." };
  }

  const flags = computeHeadsUp(rows);
  const analysis = await analyzeHealthTrends({
    metrics: rows as unknown as Record<string, unknown>[],
    flags: flags.map((f) => ({ title: f.title, detail: f.detail })),
  });
  if (!analysis) {
    return { ok: false, error: "Couldn't analyze your trends right now — please try again." };
  }

  await audit(user.id, "health.analyzed", { metadata: { days: rows.length } });
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
  const limited = await rateLimit(`chat:${user.id}`, RATE_LIMITS.aiChat);
  if (!limited.ok) return { ok: false, error: "Check-in limit reached for now — try again later." };

  const supabase = await createClient();
  const { rows, flags } = await recentMetricsAndFlags(supabase, user.id);
  if (rows.length < 3) return { ok: false, error: "Not enough data yet — give Oura a few more nights to sync." };

  const opening = await healthCheckinReply({
    metrics: rows as unknown as Record<string, unknown>[],
    flags,
    history: [],
  });
  if (!opening) return { ok: false, error: "Couldn't start a check-in right now — please try again." };

  const messages: CheckinMessage[] = [{ role: "assistant", content: opening, at: new Date().toISOString() }];
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
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid check-in" };
  const text = String(message ?? "").trim().slice(0, 1000);
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
  const reply = await healthCheckinReply({
    metrics: rows as unknown as Record<string, unknown>[],
    flags,
    history: history.map((m): CheckinTurn => ({ role: m.role, content: m.content })),
  });
  if (!reply) return { ok: false, error: "Couldn't get a reply right now — please try again." };

  const messages: CheckinMessage[] = [...history, { role: "assistant", content: reply, at: new Date().toISOString() }];
  const { error } = await supabase.from("health_checkins").update({ messages }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save your reply." };

  return { ok: true, id, messages };
}
