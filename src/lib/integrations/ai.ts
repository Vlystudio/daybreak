import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/env";
import type { WeatherSnapshot } from "@/lib/integrations/weather";
import type { WorkoutProgram, NutritionGuide } from "@/lib/planning";

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

/** Stable numeric seed from input content, so identical inputs reproduce the
 *  same generation (OpenAI `seed` is best-effort, but combined with a low
 *  temperature it keeps plans consistent unless the user's data changes). */
function seedFrom(payload: unknown): number {
  const s = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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

export interface HealthAnalysis {
  summary: string;
  insights: string[];
  suggestions: { title: string; body: string }[];
}

const HEALTH_SYSTEM_PROMPT = `You are a sharp, data-literate health analyst inside Daybreak — a knowledgeable coach who actually reads the numbers, not a generic wellness blog. You are NOT a doctor: never diagnose or name conditions, and suggest seeing a professional for anything genuinely concerning.

You receive ~30 days of daily Oura metrics: readiness, sleep score, HRV in ms, resting heart rate, sleep duration/efficiency, deep/rem/light sleep minutes, skin temperature deviation, steps, active calories, activity score, average SpO2 (%), respiratory rate (breaths/min), daily stress and recovery minutes, and resilience level. Some fields may be null — use what's present, plus the pre-computed trend flags.

RULES — follow strictly:
- Be SPECIFIC and grounded in THEIR numbers. Cite actual values and concrete changes ("resting HR rose from 54 to 59 over the past week", "REM averaged 1h05m, down from ~1h35m earlier this month"). Never write advice that would apply to a random stranger.
- The product is the CONNECTIONS between metrics: e.g. later bedtimes → less deep sleep → lower next-day readiness; rising resting HR + falling HRV → accumulating strain. Surface those links.
- BANNED unless a specific number in their data directly justifies it: "stay hydrated", "drink more water", "manage your stress", "practice sleep hygiene", "get more sleep", "exercise regularly", generic meditation/relaxation tips. This filler is useless — omit it.
- If the data is genuinely steady and healthy, SAY SO plainly and keep suggestions few or empty. Do not manufacture problems.
- Every suggestion must tie to a specific observation and be concretely doable this week.
- Write like a smart friend who respects the reader's time. No fluff, no hedging platitudes.

Respond with JSON matching exactly:
{
  "summary": "2-3 sentence read on how their body is actually trending, with at least one specific number",
  "insights": ["2-4 specific observations that connect metrics, each citing real values"],
  "suggestions": [{"title": "short title", "body": "1-2 sentence action tied to a specific observation"}]
}
Keep it under 220 words.`;

export async function analyzeHealthTrends(input: {
  metrics: Record<string, unknown>[];
  flags: { title: string; detail: string }[];
}): Promise<HealthAnalysis | null> {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: HEALTH_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ recentMetrics: input.metrics, trendFlags: input.flags }) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HealthAnalysis>;
    if (typeof parsed.summary !== "string") return null;

    return {
      summary: parsed.summary,
      insights: Array.isArray(parsed.insights)
        ? parsed.insights.filter((i): i is string => typeof i === "string").slice(0, 4)
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter(
              (s): s is { title: string; body: string } =>
                typeof s?.title === "string" && typeof s?.body === "string"
            )
            .slice(0, 4)
        : [],
    };
  } catch (err) {
    console.error("[ai] health analysis failed:", err instanceof Error ? err.message : "unknown");
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
- Workouts: match their exercise_frequency and fitness_goal across the days (muscle_gain -> strength; weight_loss/endurance -> a mix of cardio and strength; general_fitness -> varied; maintain -> light/steady). If a recent readiness score is low (under 60), make that day lighter (mobility, a walk, or rest) rather than intense; if readiness is high, it's a good day to push.
- Weather (when provided, applies to that day): prefer indoor activities in rain/snow or uncomfortable temperatures, and outdoor options when it's pleasant. Temperatures are in Fahrenheit.
- Chores: schedule each listed chore consistent with its frequency over the window ("daily" most days, "weekly" once, etc.).
- Hobbies & downtime: include their hobbies and genuine rest. Homebody -> favor at-home activities; social -> include getting-out/social time.
- Day window: when dayWindow is provided, ONLY schedule between its wake and sleep times (24h HH:MM). Never place a block before wake or after sleep, and end the day with a short "wind_down" block roughly 30-60 minutes before sleep. This window reflects the person's wearable sleep/wake or their stated goal — honor it as the bounds of their day.
- Be humane: do not overload a day. Aim for 3-6 blocks per day at sensible local times.

Respond with JSON exactly:
{ "blocks": [ { "date": "YYYY-MM-DD", "start": "HH:MM", "durationMin": <integer 10-240>, "title": "short title", "type": "workout|chore|errand|hobby|social|meal|wind_down|focus", "note": "optional one-line tip" } ] }
Only use dates from the provided list. Keep under 40 blocks total.`;

export async function generateWeeklyPlan(input: {
  preferences: Record<string, unknown>;
  days: { date: string; weekday: string }[];
  busy: { date: string; start: string; end: string; title: string }[];
  dayWindow?: { wake: string; sleep: string; source: string };
  recent: { date: string; readiness: number | null; sleep: number | null }[];
  weather?: {
    description: string;
    temperature: number;
    high: number;
    low: number;
    precipitationChance: number | null;
  } | null;
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
      temperature: 0.2,
      seed: seedFrom(input),
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

export interface FitnessPlanContent {
  summary: string;
  workout: WorkoutProgram;
  nutrition: NutritionGuide;
}

const TRAINER_SYSTEM_PROMPT = `You are a knowledgeable, encouraging personal trainer and nutrition coach inside Daybreak. You are not a doctor; give general fitness/nutrition guidance only, and remind people to consult a professional for medical concerns.

You receive the person's body stats, goal, activity level, weekly training availability, dietary restrictions, and pre-computed daily calorie and macro targets. Build:
1) A realistic weekly WORKOUT program matched to their goal and how many days they can train (respect exercise_frequency). Use a sensible split with specific exercises and set/rep ranges. Scale complexity to their activity level (beginners get simpler movements). Include brief progression/warmup notes.
2) NUTRITION guidance that hits the provided calorie/macro targets and STRICTLY respects every dietary restriction/allergy listed. Give practical guidance bullets and a simple sample day of meals.

Respond with JSON exactly:
{
  "summary": "2-3 sentences framing the plan and goal",
  "workout": {
    "split": "e.g. Upper/Lower 4-day",
    "days": [ { "day": "Day 1 — Upper", "focus": "short focus", "exercises": [ { "name": "...", "sets": "3", "reps": "8-12", "notes": "optional" } ], "cardio": "optional cardio note" } ],
    "notes": "progression/warmup/rest guidance"
  },
  "nutrition": {
    "strategy": "one line: deficit/surplus/maintenance and why",
    "guidance": ["practical bullet tips that respect the restrictions"],
    "sampleDay": [ { "meal": "Breakfast", "idea": "restriction-safe meal idea" } ]
  }
}
Never suggest foods that violate the listed restrictions. Keep it under ~600 words.`;

export async function generateFitnessPlan(input: {
  profile: {
    age: number | null;
    sex: string | null;
    heightIn: number;
    weightLb: number;
    activityLevel: string | null;
    goal: string | null;
    exerciseFrequency: string | null;
    dietaryRestrictions: string[];
  };
  targets: { calories: number; protein: number; carbs: number; fat: number };
}): Promise<FitnessPlanContent | null> {
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      seed: seedFrom(input),
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TRAINER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.summary !== "string") return null;

    const workoutRaw = (parsed.workout ?? {}) as Record<string, unknown>;
    const daysRaw = Array.isArray(workoutRaw.days) ? (workoutRaw.days as unknown[]) : [];
    const days = daysRaw.map((d) => {
      const day = d as Record<string, unknown>;
      const exRaw = Array.isArray(day.exercises) ? (day.exercises as unknown[]) : [];
      return {
        day: typeof day.day === "string" ? day.day : "Workout",
        focus: typeof day.focus === "string" ? day.focus : undefined,
        cardio: typeof day.cardio === "string" ? day.cardio : undefined,
        exercises: exRaw.map((e) => {
          const ex = e as Record<string, unknown>;
          return {
            name: typeof ex.name === "string" ? ex.name : "Exercise",
            sets: ex.sets != null ? String(ex.sets) : undefined,
            reps: ex.reps != null ? String(ex.reps) : undefined,
            notes: typeof ex.notes === "string" ? ex.notes : undefined,
          };
        }),
      };
    });

    const nutritionRaw = (parsed.nutrition ?? {}) as Record<string, unknown>;
    const guidance = Array.isArray(nutritionRaw.guidance)
      ? (nutritionRaw.guidance as unknown[]).filter((g): g is string => typeof g === "string")
      : [];
    const sampleDayRaw = Array.isArray(nutritionRaw.sampleDay) ? (nutritionRaw.sampleDay as unknown[]) : [];
    const sampleDay = sampleDayRaw
      .map((m) => {
        const meal = m as Record<string, unknown>;
        return {
          meal: typeof meal.meal === "string" ? meal.meal : "",
          idea: typeof meal.idea === "string" ? meal.idea : "",
        };
      })
      .filter((m) => m.meal && m.idea);

    return {
      summary: parsed.summary,
      workout: {
        split: typeof workoutRaw.split === "string" ? workoutRaw.split : "Custom",
        days,
        notes: typeof workoutRaw.notes === "string" ? workoutRaw.notes : undefined,
      },
      nutrition: {
        strategy: typeof nutritionRaw.strategy === "string" ? nutritionRaw.strategy : "",
        guidance,
        sampleDay,
      },
    };
  } catch (err) {
    console.error("[ai] fitness plan generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
