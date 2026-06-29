import "server-only";
import { openaiClient, logUsage } from "@/lib/integrations/openai";
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

/** Self-reported feeling (1-5 each), the signal a wearable can't capture. */
export interface SubjectiveForPrompt {
  mood: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  note: string | null;
}

/**
 * Normalized, source-aware health context (from the understanding/plan-input
 * layer). Lets the AI speak honestly about which sources informed today and how
 * confident the read is — without assuming any specific device.
 */
export interface HealthContextForPrompt {
  mode: string; // recommendedPlanMode
  confidence: string; // "High" | "Medium" | "Low"
  sources: string[]; // human labels, e.g. ["Apple Health", "Manual check-in"]
  reasons: string[];
  stale: boolean;
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

When a self-reported check-in is provided (mood/energy/stress/soreness, each 1-5 where 5 is high), weave it in and let it gently override the wearable: if they feel drained or sore, ease off even when readiness looks fine; if they feel great, encourage them. Acknowledge how they say they feel.

When a "health" context is provided, it tells you which sources informed today (e.g. Oura, Apple Health, Fitbit, or just a manual check-in) and how confident the read is. You may briefly and naturally mention the sources ("based on your Apple Health and check-in…") and, when data is missing or stale, note that today's confidence is a little lower and lean more on how they say they feel. Never name a device they aren't using, and never diagnose — keep it wellness guidance.

Respond with JSON matching exactly this shape:
{
  "summary": "2-3 sentences greeting the person and summarizing how their body is doing today, weaving in sleep/readiness/HRV, how they say they feel, and the weather",
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
  subjective?: SubjectiveForPrompt | null;
  health?: HealthContextForPrompt | null;
}): Promise<MorningBriefing | null> {
  const client = openaiClient();
  if (!client) return null;

  const userPayload = {
    name: input.displayName || "there",
    today: input.todayMetrics,
    last7Days: input.recentMetrics,
    health: input.health ?? null,
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
    howTheyFeel: input.subjective ?? null,
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

    logUsage("morning-briefing", completion.usage);
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
    console.error(
      "[ai] briefing generation failed:",
      err instanceof Error ? err.message : "unknown"
    );
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
- When you mention a sleep STAGE (deep/REM/light), make clear it's one stage of the night, not total sleep (e.g. "deep sleep, the deepest stage, was ~70 min"). Deep sleep is normally only ~45-90 min, so don't treat a low minute count as alarmingly little sleep.
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
  const client = openaiClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: HEALTH_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ recentMetrics: input.metrics, trendFlags: input.flags }),
        },
      ],
    });

    logUsage("health-analysis", completion.usage);
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

const FUSED_HEALTH_SYSTEM_PROMPT = `You are a careful, data-literate health analyst inside Daybreak. You are NOT a doctor and Daybreak is NOT a medical device.

You are given Daybreak's DETERMINISTIC, source-aware health understanding: daily signals that have ALREADY been fused across trackers (Oura, Apple Health), tagged with a primary source and a confidence level, compared to the user's own personal baseline, plus pre-computed honest insights and any cross-tracker conflicts. Your ONLY job is to explain these findings in plain, warm language — NOT to invent new conclusions, re-derive numbers, or diagnose.

STRICT RULES:
- Use cautious framing: "suggests", "may indicate", "compared to your baseline", "tends to", and explicitly say "lower confidence" when a signal's confidence is low or medium.
- NEVER diagnose or assert a condition. Banned: "you are sick", "you have", "diagnosis", naming illnesses. Instead: "your data shows a pattern that may be worth paying attention to."
- Ground every statement in the provided signals/baselines — cite the actual values and the % vs baseline. Never give advice that would apply to a random stranger.
- When a metric has a source conflict or low confidence, SAY SO in the relevant insight.
- Calories/energy are rough estimates — never present them as exact.
- If the data is steady and healthy, say so plainly; do not manufacture problems.
- If overallConfidence is low or there are few days of data, lead with that caveat and keep claims tentative.
- Respect the deterministic insights you're given — expand/clarify them; don't contradict them.

Respond with JSON matching exactly:
{
  "summary": "2-3 sentences on how their body is trending, citing a specific value and noting confidence",
  "insights": ["2-4 specific observations tied to real values and baselines; mention low confidence / source conflicts where relevant"],
  "suggestions": [{"title": "short title", "body": "1-2 sentence, concrete, tied to a specific observation"}]
}
Keep it under 220 words. Use "may", "suggests", "compared to your baseline".`;

/** Explain the deterministic, source-aware understanding (never raw source rows). */
export async function analyzeFusedHealth(
  input: Record<string, unknown>
): Promise<HealthAnalysis | null> {
  const client = openaiClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: FUSED_HEALTH_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    });

    logUsage("health-analysis-fused", completion.usage);
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
    console.error(
      "[ai] fused health analysis failed:",
      err instanceof Error ? err.message : "unknown"
    );
    return null;
  }
}

export interface CheckinTurn {
  role: "assistant" | "user";
  content: string;
}

export interface CheckinAction {
  title: string;
  durationMin: number;
  time: string; // local "HH:MM"
  daysOfWeek: number[]; // 0=Sun..6=Sat; empty = every day
}

export interface CheckinReply {
  message: string;
  action: CheckinAction | null;
}

const CHECKIN_SYSTEM_PROMPT = `You are a thoughtful health coach inside Daybreak, having a SHORT, real back-and-forth check-in with someone about their Oura data. You are NOT a doctor: never diagnose or name conditions; suggest a professional for anything genuinely concerning.

You're given their recent daily metrics + pre-computed trend flags + the conversation so far.

How to respond:
- If the conversation is just starting (no messages yet), OPEN with ONE specific, curious question grounded in a real pattern in their data — cite the actual numbers. Ask, don't lecture.
- Otherwise, respond to what they just said: briefly reflect it, connect it to their data, and then EITHER give one concrete, specific suggestion OR ask one sharper follow-up. Two to four sentences.
- Always be specific with their numbers. NEVER use generic filler ("drink water", "get more sleep", "manage stress", "stay hydrated"). Warm, concise — like a smart friend who has the data in front of them.
- When you mention a sleep STAGE (deep, REM, or light sleep), make clear it's ONE STAGE of the night, not total sleep — e.g. "deep sleep (the deepest stage)". Deep sleep is normally only ~45-90 min per night, so small minute counts are expected.

Turning talk into action:
- When the person clearly AGREES to a concrete, schedulable habit (e.g. "a 10-minute walk after dinner a few times this week"), set "action" to that habit AND make your "message" warmly offer to add it to their schedule and invite them to confirm.
- Otherwise set "action" to null.
- "action" shape: { "title": short label like "Evening walk", "durationMin": realistic integer 5-180, "time": a sensible local "HH:MM", "daysOfWeek": array of integers 0-6 (0=Sunday) — empty for every day, or ~3-4 days for "a few times a week" }.

Respond with JSON exactly: { "message": "your next message", "action": null OR { "title": "...", "durationMin": 10, "time": "19:30", "daysOfWeek": [1,3,5] } }`;

const VALID_DOW = new Set([0, 1, 2, 3, 4, 5, 6]);

/** One coach turn: returns the assistant's next message + an optional schedulable action. */
export async function healthCheckinReply(input: {
  metrics: Record<string, unknown>[];
  flags: { title: string; detail: string }[];
  history: CheckinTurn[];
}): Promise<CheckinReply | null> {
  const client = openaiClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CHECKIN_SYSTEM_PROMPT },
        {
          role: "system",
          content: `Their data — recentMetrics: ${JSON.stringify(input.metrics)}; trendFlags: ${JSON.stringify(input.flags)}`,
        },
        ...input.history.map((t) => ({ role: t.role, content: t.content })),
      ],
    });
    logUsage("health-checkin", completion.usage);
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { message?: unknown; action?: unknown };
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (!message) return null;

    let action: CheckinAction | null = null;
    const a = parsed.action as Record<string, unknown> | null | undefined;
    if (a && typeof a === "object") {
      const title = typeof a.title === "string" ? a.title.trim().slice(0, 80) : "";
      const time =
        typeof a.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time) ? a.time : null;
      const durationMin = Number(a.durationMin);
      const days = Array.isArray(a.daysOfWeek)
        ? (a.daysOfWeek as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && VALID_DOW.has(n))
        : [];
      if (title && time && Number.isFinite(durationMin)) {
        action = {
          title,
          durationMin: Math.min(180, Math.max(5, Math.round(durationMin))),
          time,
          daysOfWeek: Array.from(new Set(days)),
        };
      }
    }

    return { message, action };
  } catch (err) {
    console.error("[ai] health check-in failed:", err instanceof Error ? err.message : "unknown");
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

You receive: the person's preferences, the days to plan (with weekday names), the times they are already busy, and their recent recovery and sleep (readiness/sleep scores 0-100 WHEN AVAILABLE, from whichever wearable they use — Oura, Apple Health, Fitbit/Google — or none at all).

Rules:
- NEVER overlap a "busy" block or another block you create; leave a little buffer.
- Respect their work type and work_schedule. If planning_scope is "after_hours", only place blocks before work or in the evening. If "weekends", only use the weekend days provided.
- Workouts: match their exercise_frequency and fitness_goal across the days (muscle_gain -> strength; weight_loss/endurance -> a mix of cardio and strength; general_fitness -> varied; maintain -> light/steady). If a recent readiness score is low (under 60), make that day lighter (mobility, a walk, or rest) rather than intense; if readiness is high, it's a good day to push.
- Health context (when "health" is provided, it applies to TODAY): it states which sources informed today, the plan confidence (High/Medium/Low), and whether wearable data is missing or stale. If confidence is Low or the data is stale/missing, lean on the check-in and keep today moderate and kind; never assume a specific device exists or that readiness scores are present.
- Self-reported check-in (when "checkin" is provided, it applies to the EARLIEST/today day; mood/energy/stress/soreness each 1-5 where 5 is high): this is how the person says they feel today — let it gently override the wearable. If energy or mood is low (1-2), or soreness or stress is high (4-5), make today noticeably lighter and kinder (shorter blocks, gentle movement or rest, more downtime) even if readiness looks fine. If energy is high (4-5), it's a good day to do a bit more. Honor how they say they feel.
- Weather (when provided, applies to that day): prefer indoor activities in rain/snow or uncomfortable temperatures, and outdoor options when it's pleasant. Temperatures are in Fahrenheit.
- Chores: schedule each listed chore consistent with its frequency over the window ("daily" most days, "weekly" once, etc.).
- Hobbies & downtime: include their hobbies and genuine rest. Homebody -> favor at-home activities; social -> include getting-out/social time.
- Day window: when dayWindow is provided, ONLY schedule between its wake and sleep times (24h HH:MM). Never place a block before wake or after sleep, and end the day with a short "wind_down" block roughly 30-60 minutes before sleep. This window reflects the person's wearable sleep/wake or their stated goal — honor it as the bounds of their day.
- Reflection (when provided, from their last evening review): treat their stated intention for tomorrow as a priority for the earliest planned day, lean into what they said went well, and adjust away from what they wanted to improve. Their own words outrank generic defaults.
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
  reflection?: {
    wentWell: string | null;
    toImprove: string | null;
    tomorrowIntention: string | null;
  } | null;
  checkin?: {
    mood: number | null;
    energy: number | null;
    stress: number | null;
    soreness: number | null;
  } | null;
  health?: HealthContextForPrompt | null;
}): Promise<PlanBlock[] | null> {
  const client = openaiClient();
  if (!client) return null;
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

    logUsage("weekly-plan", completion.usage);
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

      const type = (
        typeof b.type === "string" && validTypes.has(b.type) ? b.type : "focus"
      ) as PlanBlockType;

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
  const client = openaiClient();
  if (!client) return null;

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

    logUsage("fitness-plan", completion.usage);
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
    const sampleDayRaw = Array.isArray(nutritionRaw.sampleDay)
      ? (nutritionRaw.sampleDay as unknown[])
      : [];
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
    console.error(
      "[ai] fitness plan generation failed:",
      err instanceof Error ? err.message : "unknown"
    );
    return null;
  }
}
