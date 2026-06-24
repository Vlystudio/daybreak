import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { birdLevel, type BirdPalette } from "@/lib/game/birds";

/**
 * The reward economy. `syncDailyRewards` recomputes what the user has earned
 * today from their actual completions and grants only what hasn't been paid yet
 * (idempotent via reward_ledger's unique key) — so visiting the Nest "collects"
 * the day's seeds. The active bird gains the same amount as XP.
 */

export const SEED_COST_EGG = 60;

const EARN = {
  daily_login: 5,
  habit: 5,
  event: 4,
  checkin: 10,
  food_logged: 6,
  protein_goal: 12,
  evening_review: 10,
  weight_logged: 6,
} as const;

const MAX_EVENTS_REWARDED = 8;

function localToday(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

interface Candidate {
  key: string;
  source: string;
  amount: number;
}

export interface EarnLine {
  label: string;
  amount: number;
  done: boolean;
}

export interface OwnedBird {
  id: string;
  species_key: string | null;
  source: "hatched" | "photo";
  nickname: string | null;
  custom_name: string | null;
  custom_blurb: string | null;
  custom_palette: BirdPalette | null;
  custom_crest: boolean | null;
  custom_long_tail: boolean | null;
  xp: number;
  level: number;
  happiness: number;
  last_fed_at: string | null;
  accessory: string | null;
  hatched_at: string;
}

export interface BredEgg {
  id: string;
  rarity: string;
  hatchAt: string;
}

export interface GameState {
  seeds: number;
  totalEarned: number;
  activeBirdId: string | null;
  birds: OwnedBird[];
  earnedToday: number;
  earnable: EarnLine[];
  justGranted: number;
  starterDone: boolean;
  freeHatches: number;
  inventory: Record<string, number>;
  decor: string[];
  eggs: BredEgg[];
  birdHouse: string | null;
}

/** Build the day's earn candidates from real completions. */
async function candidatesForToday(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  today: string
): Promise<{ candidates: Candidate[]; earnable: EarnLine[] }> {
  const dayStart = `${today}T00:00:00Z`;
  const dayEnd = `${today}T23:59:59Z`;

  const [{ data: habitLogs }, { data: events }, { data: checkin }, { data: foods }, { data: goals }, { data: review }, { data: weight }] =
    await Promise.all([
      admin.from("habit_logs").select("habit_id").eq("user_id", userId).eq("date", today).returns<{ habit_id: string }[]>(),
      admin.from("schedule_events").select("id, completed_at").eq("user_id", userId).gte("starts_at", dayStart).lte("starts_at", dayEnd).not("completed_at", "is", null).returns<{ id: string; completed_at: string }[]>(),
      admin.from("subjective_checkins").select("date").eq("user_id", userId).eq("date", today).maybeSingle<{ date: string }>(),
      admin.from("food_logs").select("protein_g").eq("user_id", userId).eq("date", today).returns<{ protein_g: number | null }[]>(),
      admin.from("nutrition_goals").select("protein_g").eq("user_id", userId).maybeSingle<{ protein_g: number | null }>(),
      admin.from("evening_reviews").select("date").eq("user_id", userId).eq("date", today).maybeSingle<{ date: string }>(),
      admin.from("body_measurements").select("date").eq("user_id", userId).eq("date", today).maybeSingle<{ date: string }>(),
    ]);

  const candidates: Candidate[] = [{ key: `${today}|login`, source: "daily_login", amount: EARN.daily_login }];

  for (const h of habitLogs ?? []) candidates.push({ key: `${today}|habit|${h.habit_id}`, source: "habit", amount: EARN.habit });
  for (const e of (events ?? []).slice(0, MAX_EVENTS_REWARDED)) candidates.push({ key: `${today}|event|${e.id}`, source: "event", amount: EARN.event });

  const hasFood = (foods ?? []).length > 0;
  const proteinSum = (foods ?? []).reduce((s, f) => s + (f.protein_g ?? 0), 0);
  const proteinGoal = goals?.protein_g ?? null;
  const proteinMet = proteinGoal != null && proteinGoal > 0 && proteinSum >= proteinGoal;

  if (checkin) candidates.push({ key: `${today}|checkin`, source: "checkin", amount: EARN.checkin });
  if (hasFood) candidates.push({ key: `${today}|food`, source: "food_logged", amount: EARN.food_logged });
  if (proteinMet) candidates.push({ key: `${today}|protein`, source: "protein_goal", amount: EARN.protein_goal });
  if (review) candidates.push({ key: `${today}|review`, source: "evening_review", amount: EARN.evening_review });
  if (weight) candidates.push({ key: `${today}|weight`, source: "weight_logged", amount: EARN.weight_logged });

  const habitCount = (habitLogs ?? []).length;
  const eventCount = Math.min((events ?? []).length, MAX_EVENTS_REWARDED);
  const earnable: EarnLine[] = [
    { label: "Open Daybreak today", amount: EARN.daily_login, done: true },
    { label: habitCount > 0 ? `Habits done (${habitCount})` : "Complete a habit", amount: EARN.habit * Math.max(1, habitCount), done: habitCount > 0 },
    { label: eventCount > 0 ? `Plan tasks done (${eventCount})` : "Finish a planned task", amount: EARN.event * Math.max(1, eventCount), done: eventCount > 0 },
    { label: "Daily check-in", amount: EARN.checkin, done: Boolean(checkin) },
    { label: "Log your food", amount: EARN.food_logged, done: hasFood },
    { label: "Hit your protein goal", amount: EARN.protein_goal, done: proteinMet },
    { label: "Evening review", amount: EARN.evening_review, done: Boolean(review) },
    { label: "Log your weight", amount: EARN.weight_logged, done: Boolean(weight) },
  ];

  return { candidates, earnable };
}

/** Ensure a game row exists; returns it. */
async function ensureGame(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from("user_game").select("seeds, total_earned, active_bird_id, last_login_on").eq("user_id", userId).maybeSingle<{ seeds: number; total_earned: number; active_bird_id: string | null; last_login_on: string | null }>();
  if (data) return data;
  const { data: created } = await admin.from("user_game").insert({ user_id: userId }).select("seeds, total_earned, active_bird_id, last_login_on").single<{ seeds: number; total_earned: number; active_bird_id: string | null; last_login_on: string | null }>();
  return created ?? { seeds: 0, total_earned: 0, active_bird_id: null, last_login_on: null };
}

/** Grant any unpaid rewards for today. Returns the amount just granted. */
export async function syncDailyRewards(userId: string, timeZone: string): Promise<number> {
  const admin = createAdminClient();
  const today = localToday(timeZone);
  const game = await ensureGame(admin, userId);

  const { candidates } = await candidatesForToday(admin, userId, today);

  // Insert only new keys (idempotent); returned rows are the newly granted ones.
  const { data: inserted } = await admin
    .from("reward_ledger")
    .upsert(
      candidates.map((c) => ({ user_id: userId, key: c.key, source: c.source, amount: c.amount, awarded_on: today })),
      { onConflict: "user_id,key", ignoreDuplicates: true }
    )
    .select("amount")
    .returns<{ amount: number }[]>();

  const granted = (inserted ?? []).reduce((s, r) => s + r.amount, 0);
  if (granted > 0) {
    await admin
      .from("user_game")
      .update({ seeds: game.seeds + granted, total_earned: game.total_earned + granted, last_login_on: today })
      .eq("user_id", userId);
    // The companion shares in the day's effort.
    if (game.active_bird_id) {
      const { data: bird } = await admin.from("user_birds").select("xp").eq("id", game.active_bird_id).maybeSingle<{ xp: number }>();
      if (bird) await admin.from("user_birds").update({ xp: bird.xp + granted }).eq("id", game.active_bird_id);
    }
  } else if (game.last_login_on !== today) {
    await admin.from("user_game").update({ last_login_on: today }).eq("user_id", userId);
  }
  return granted;
}

/** Full game state for the Nest page (syncs rewards first). */
export async function loadGame(userId: string, timeZone: string): Promise<GameState> {
  const justGranted = await syncDailyRewards(userId, timeZone);
  const admin = createAdminClient();
  const today = localToday(timeZone);

  const [{ data: game }, { data: birds }, { data: todayLedger }, { data: invRows }, { data: eggRows }, { earnable }] = await Promise.all([
    admin.from("user_game").select("seeds, total_earned, active_bird_id, starter_done, free_hatches, decor, bird_house").eq("user_id", userId).maybeSingle<{ seeds: number; total_earned: number; active_bird_id: string | null; starter_done: boolean; free_hatches: number; decor: string[]; bird_house: string | null }>(),
    admin.from("user_birds").select("id, species_key, source, nickname, custom_name, custom_blurb, custom_palette, custom_crest, custom_long_tail, xp, happiness, last_fed_at, accessory, hatched_at").eq("user_id", userId).order("hatched_at", { ascending: false }).returns<Omit<OwnedBird, "level">[]>(),
    admin.from("reward_ledger").select("amount").eq("user_id", userId).eq("awarded_on", today).returns<{ amount: number }[]>(),
    admin.from("user_inventory").select("item_key, qty").eq("user_id", userId).gt("qty", 0).returns<{ item_key: string; qty: number }[]>(),
    admin.from("user_eggs").select("id, rarity, hatch_at").eq("user_id", userId).order("created_at", { ascending: true }).returns<{ id: string; rarity: string; hatch_at: string }[]>(),
    candidatesForToday(admin, userId, today),
  ]);

  return {
    seeds: game?.seeds ?? 0,
    totalEarned: game?.total_earned ?? 0,
    activeBirdId: game?.active_bird_id ?? null,
    birds: (birds ?? []).map((b) => ({ ...b, level: birdLevel(b.xp) })),
    earnedToday: (todayLedger ?? []).reduce((s, r) => s + r.amount, 0),
    earnable,
    justGranted,
    starterDone: game?.starter_done ?? false,
    freeHatches: game?.free_hatches ?? 0,
    inventory: Object.fromEntries((invRows ?? []).map((r) => [r.item_key, r.qty])),
    decor: game?.decor ?? [],
    eggs: (eggRows ?? []).map((e) => ({ id: e.id, rarity: e.rarity, hatchAt: e.hatch_at })),
    birdHouse: game?.bird_house ?? null,
  };
}
