/**
 * Cross-signal insight engine. Finds correlations across the signals Daybreak
 * collects — Oura/Fitbit metrics, subjective check-ins, intake, habits — and
 * phrases the strongest, most useful ones in plain language. Pure and
 * deterministic so it's cheap and testable; no LLM required.
 */

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  readiness: number | null;
  sleep_score: number | null;
  hrv: number | null;
  resting_hr: number | null;
  steps: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  calories: number | null;
  protein: number | null;
  habitsDone: number | null;
}

export interface Insight {
  id: string;
  headline: string;
  detail: string;
  r: number;
  n: number;
  strength: "strong" | "moderate";
  tone: "positive" | "watch";
}

type Field = Exclude<keyof DailyRecord, "date">;

/** Pearson correlation over complete pairs; null if too few or no variance. */
function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 8) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

interface Candidate {
  id: string;
  a: Field;
  b: Field;
  /** 0 = same day; 1 = a today vs b the next day. */
  lag: 0 | 1;
  /** Phrasing for a positive vs negative correlation; null suppresses it. */
  positive: { headline: string; detail: string } | null;
  negative: { headline: string; detail: string } | null;
}

const CANDIDATES: Candidate[] = [
  {
    id: "sleep-mood",
    a: "sleep_score", b: "mood", lag: 0,
    positive: { headline: "Sleep sets your mood", detail: "Your mood tracks your sleep score — protecting a good night pays off the next day." },
    negative: null,
  },
  {
    id: "sleep-energy",
    a: "sleep_score", b: "energy", lag: 0,
    positive: { headline: "Rest fuels your energy", detail: "Better-slept nights show up as higher energy. An earlier wind-down is your lever." },
    negative: null,
  },
  {
    id: "readiness-mood",
    a: "readiness", b: "mood", lag: 0,
    positive: { headline: "Recovery lifts your mood", detail: "On higher-readiness days you feel better. Honor low-readiness days with a lighter plan." },
    negative: null,
  },
  {
    id: "stress-sleep",
    a: "stress", b: "sleep_score", lag: 0,
    positive: null,
    negative: { headline: "Stress costs you sleep", detail: "Your higher-stress days come with worse sleep. A short evening unwind may help most on busy days." },
  },
  {
    id: "stress-sleep-next",
    a: "stress", b: "sleep_score", lag: 1,
    positive: null,
    negative: { headline: "Today's stress, tonight's sleep", detail: "Stressful days tend to be followed by lower sleep scores. Build in a buffer before bed after hard days." },
  },
  {
    id: "steps-mood",
    a: "steps", b: "mood", lag: 0,
    positive: { headline: "Moving lifts your mood", detail: "More steps line up with better mood. Even a short walk on a flat day tends to help." },
    negative: null,
  },
  {
    id: "steps-energy",
    a: "steps", b: "energy", lag: 0,
    positive: { headline: "Activity begets energy", detail: "Your more active days are your higher-energy days — movement seems to give back more than it costs." },
    negative: null,
  },
  {
    id: "soreness-readiness",
    a: "soreness", b: "readiness", lag: 0,
    positive: null,
    negative: { headline: "Soreness flags lower recovery", detail: "When you feel sore, readiness is lower too — a good day to favor mobility over intensity." },
  },
  {
    id: "protein-readiness-next",
    a: "protein", b: "readiness", lag: 1,
    positive: { headline: "Protein today, recovery tomorrow", detail: "Higher-protein days tend to be followed by better readiness. Worth front-loading protein on training days." },
    negative: null,
  },
  {
    id: "habits-mood",
    a: "habitsDone", b: "mood", lag: 0,
    positive: { headline: "Habits feed your mood", detail: "Days you complete more habits, your mood is higher — the small wins compound." },
    negative: null,
  },
  {
    id: "hrv-stress",
    a: "hrv", b: "stress", lag: 0,
    positive: null,
    negative: { headline: "Stress shows up in your HRV", detail: "Higher-stress days come with lower HRV — your body is corroborating how you feel." },
  },
  {
    id: "restinghr-sleep",
    a: "resting_hr", b: "sleep_score", lag: 0,
    positive: null,
    negative: { headline: "A racing resting heart, rougher sleep", detail: "Nights with a higher resting heart rate score worse — often a sign of late meals, alcohol, or stress." },
  },
  {
    id: "calories-energy",
    a: "calories", b: "energy", lag: 0,
    positive: { headline: "Underfueling drains you", detail: "Your higher-intake days track with higher energy — make sure you're eating enough on active days." },
    negative: null,
  },
];

function pairsFor(records: DailyRecord[], byDate: Map<string, DailyRecord>, c: Candidate): [number, number][] {
  const out: [number, number][] = [];
  for (const rec of records) {
    const av = rec[c.a];
    let target: DailyRecord | undefined = rec;
    if (c.lag === 1) {
      const next = new Date(`${rec.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      target = byDate.get(next.toISOString().slice(0, 10));
    }
    const bv = target ? target[c.b] : null;
    if (typeof av === "number" && typeof bv === "number") out.push([av, bv]);
  }
  return out;
}

export function computeInsights(records: DailyRecord[], max = 5): Insight[] {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((r) => [r.date, r]));

  const found: Insight[] = [];
  for (const c of CANDIDATES) {
    const pairs = pairsFor(sorted, byDate, c);
    const r = pearson(pairs);
    if (r == null || Math.abs(r) < 0.35) continue;
    const framing = r >= 0 ? c.positive : c.negative;
    if (!framing) continue;
    found.push({
      id: c.id,
      headline: framing.headline,
      detail: framing.detail,
      r: Math.round(r * 100) / 100,
      n: pairs.length,
      strength: Math.abs(r) >= 0.6 ? "strong" : "moderate",
      tone: c.positive && r >= 0 ? "positive" : "watch",
    });
  }

  // Strongest first; cap so the UI shows the most meaningful handful.
  return found.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, max);
}
