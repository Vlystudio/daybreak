import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/env";
import type { WeatherSnapshot } from "@/lib/integrations/weather";

/**
 * AI morning briefing via the OpenAI API. Health data is sent to OpenAI to
 * generate the summary (disclosed in the README) but is never logged here.
 */

export interface MetricsForPrompt {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_duration_min: number | null;
  sleep_efficiency: number | null;
}

export interface EventForPrompt {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface MorningBriefing {
  summary: string;
  focus: string;
  insights: string[];
  recommendations: { title: string; body: string }[];
}

const SYSTEM_PROMPT = `You are the morning companion inside Daybreak, a warm and trustworthy wellness app.
Write like a kind, knowledgeable friend — encouraging, concrete, never preachy or alarmist.
You are not a doctor and must not give medical advice; frame everything as gentle lifestyle guidance.

Respond with JSON matching exactly this shape:
{
  "summary": "2-3 sentences greeting the person and summarizing how their body is doing today, weaving in sleep/readiness/HRV and the weather",
  "focus": "one short sentence naming the single most useful intention for today",
  "insights": ["2-4 short observations comparing today to their recent trend"],
  "recommendations": [{"title": "short title", "body": "1-2 sentence actionable suggestion"}]
}
Provide 2-4 recommendations. Keep the total under 250 words.`;

export async function generateMorningBriefing(input: {
  displayName: string;
  todayMetrics: MetricsForPrompt | null;
  recentMetrics: MetricsForPrompt[];
  weather: WeatherSnapshot | null;
  todayEvents: EventForPrompt[];
}): Promise<MorningBriefing | null> {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  const userPayload = {
    name: input.displayName || "there",
    today: input.todayMetrics,
    last7Days: input.recentMetrics,
    weather: input.weather
      ? {
          description: input.weather.description,
          temperature: input.weather.temperature,
          high: input.weather.tempMax,
          low: input.weather.tempMin,
          unit: "fahrenheit",
          precipitationChance: input.weather.precipitationChance,
          sunrise: input.weather.sunrise,
          sunset: input.weather.sunset,
        }
      : null,
    schedule: input.todayEvents.slice(0, 12),
  };

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MorningBriefing>;
    if (typeof parsed.summary !== "string" || typeof parsed.focus !== "string") return null;

    return {
      summary: parsed.summary,
      focus: parsed.focus,
      insights: Array.isArray(parsed.insights)
        ? parsed.insights.filter((i): i is string => typeof i === "string").slice(0, 4)
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .filter(
              (r): r is { title: string; body: string } =>
                typeof r?.title === "string" && typeof r?.body === "string"
            )
            .slice(0, 4)
        : [],
    };
  } catch (err) {
    // Log the failure class only — never the prompt or response (health data).
    console.error("[ai] briefing generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

export type PlanBlockType =
  | "workout"
  | "chore"
  | "errand"
  | "hobby"
  | "social"
  | "meal"
  | "wind_down"
  | "focus";

export interface PlanBlock {
  date: string; // YYYY-MM-DD (from the provided days)
  start: string; // HH:MM, 24-hour, local
  durationMin: number;
  title: string;
  type: PlanBlockType;
  note?: string;
}

const PLAN_SYSTEM_PROMPT = `You are the planning engine inside Daybreak, a warm wellness app. You build a realistic, balanced schedule for a person from their lifestyle, goals, and existing commitments. You are not a doctor; keep any fitness guidance gentle and general.

You receive: the person's preferences, the days to plan (with weekday names), the times they are already busy, and their recent recovery (Oura readiness/sleep, 0-100).

Rules:
- NEVER overlap a "busy" block or another block you create; leave a little buffer.
- Respect their work type and work_schedule. If planning_scope is "after_hours", only place blocks before work or in the evening. If "weekends", only use the weekend days provided.
- Workouts: match their exercise_frequency and fitness_goal across the days (muscle_gain -> strength; weight_loss/endurance -> a mix of cardio and strength; general_fitness -> varied; maintain -> light/steady). If a recent readiness score is low (under 60), make that day lighter (mobility, a walk, or rest) rather than intense.
- Chores: schedule each listed chore consistent with its frequency over the window ("daily" most days, "weekly" once, etc.).
- Hobbies & downtime: include their hobbies and genuine rest. Homebody -> favor at-home activities; social -> include getting-out/social time.
- Be humane: do not overload a day. Aim for 3-6 blocks per day at sensible local times.

Respond with JSON exactly:
{ "blocks": [ { "date": "YYYY-MM-DD", "start": "HH:MM", "durationMin": <integer 10-240>, "title": "short title", "type": "workout|chore|errand|hobby|social|meal|wind_down|focus", "note": "optional one-line tip" } ] }
Only use dates from the provided list. Keep under 40 blocks total.`;

export async function generateWeeklyPlan(input: {
  preferences: Record<string, unknown>;
  days: { date: string; weekday: string }[];
  busy: { date: string; start: string; end: string; title: string }[];
  recent: { date: string; readiness: number | null; sleep: number | null }[];
}): Promise<PlanBlock[] | null> {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const validDates = new Set(input.days.map((d) => d.date));
  const validTypes = new Set<string>([
    "workout",
    "chore",
    "errand",
    "hobby",
    "social",
    "meal",
    "wind_down",
    "focus",
  ]);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { blocks?: unknown };
    if (!Array.isArray(parsed.blocks)) return null;

    const blocks: PlanBlock[] = [];
    for (const item of parsed.blocks as unknown[]) {
      const b = item as Record<string, unknown>;
      if (typeof b.date !== "string" || !validDates.has(b.date)) continue;
      if (typeof b.start !== "string" || !/^\d{2}:\d{2}$/.test(b.start)) continue;
      if (typeof b.title !== "string" || !b.title.trim()) continue;

      let dur = Number(b.durationMin);
      if (!Number.isFinite(dur)) dur = 30;
      dur = Math.min(240, Math.max(10, Math.round(dur)));

      const type = (typeof b.type === "string" && validTypes.has(b.type) ? b.type : "focus") as PlanBlockType;

      blocks.push({
        date: b.date,
        start: b.start,
        durationMin: dur,
        title: b.title.trim().slice(0, 120),
        type,
        note: typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 200) : undefined,
      });
      if (blocks.length >= 40) break;
    }

    return blocks;
  } catch (err) {
    console.error("[ai] plan generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
