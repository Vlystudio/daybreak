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
