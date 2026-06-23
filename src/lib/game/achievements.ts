import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Achievements / badges. A catalog of milestones computed deterministically from
 * the data the user already generates — no new tables, no double-awarding. Shown
 * as a trophy case on the Profile.
 */

export interface AchievementStats {
  seeds: number;
  streak: number;
  habitDone: number;
  birds: number;
  species: number;
  photoBirds: number;
  foods: number;
  checkins: number;
  reviews: number;
  weights: number;
}

interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  metric: keyof AchievementStats;
  target: number;
}

const CATALOG: AchievementDef[] = [
  { id: "first_light", name: "First Light", emoji: "🌅", metric: "seeds", target: 1, desc: "Earn your first seeds" },
  { id: "seedling", name: "Seedling", emoji: "🌱", metric: "seeds", target: 100, desc: "Earn 100 seeds" },
  { id: "gardener", name: "Gardener", emoji: "🌻", metric: "seeds", target: 1000, desc: "Earn 1,000 seeds" },
  { id: "on_fire", name: "On Fire", emoji: "🔥", metric: "streak", target: 7, desc: "Keep a 7-day streak" },
  { id: "unstoppable", name: "Unstoppable", emoji: "⚡", metric: "streak", target: 30, desc: "Keep a 30-day streak" },
  { id: "getting_started", name: "Getting Started", emoji: "✅", metric: "habitDone", target: 1, desc: "Complete a habit" },
  { id: "habit_hero", name: "Habit Hero", emoji: "🦸", metric: "habitDone", target: 50, desc: "Complete 50 habits" },
  { id: "centurion", name: "Centurion", emoji: "💯", metric: "habitDone", target: 100, desc: "Complete 100 habits" },
  { id: "hatchling", name: "Hatchling", emoji: "🐣", metric: "birds", target: 1, desc: "Hatch your first bird" },
  { id: "flock_starter", name: "Flock Starter", emoji: "🪺", metric: "birds", target: 5, desc: "Collect 5 birds" },
  { id: "aviary", name: "Aviary", emoji: "🦜", metric: "species", target: 10, desc: "Collect 10 species" },
  { id: "birdwatcher", name: "Birdwatcher", emoji: "📸", metric: "photoBirds", target: 1, desc: "Photograph a real bird" },
  { id: "nourished", name: "Nourished", emoji: "🍎", metric: "foods", target: 10, desc: "Log 10 meals" },
  { id: "food_critic", name: "Food Critic", emoji: "🍽️", metric: "foods", target: 100, desc: "Log 100 meals" },
  { id: "in_tune", name: "In Tune", emoji: "🫶", metric: "checkins", target: 10, desc: "Check in 10 times" },
  { id: "reflective", name: "Reflective", emoji: "🌙", metric: "reviews", target: 7, desc: "Do 7 evening reviews" },
  { id: "tracked", name: "Tracked", emoji: "⚖️", metric: "weights", target: 10, desc: "Log your weight 10 times" },
];

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  current: number;
  target: number;
  earned: boolean;
}

export function computeAchievements(stats: AchievementStats): Achievement[] {
  return CATALOG.map((a) => {
    const current = stats[a.metric];
    return { id: a.id, name: a.name, desc: a.desc, emoji: a.emoji, current, target: a.target, earned: current >= a.target };
  });
}

async function count(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  userId: string
): Promise<number> {
  const { count: c } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  return c ?? 0;
}

/** Gather the raw counts the catalog needs. `seeds` and `streak` come from progress. */
export async function gatherAchievementStats(
  userId: string,
  seeds: number,
  streak: number
): Promise<AchievementStats> {
  const admin = createAdminClient();
  const [habitDone, foods, checkins, reviews, weights, { data: birds }] = await Promise.all([
    count(admin, "habit_logs", userId),
    count(admin, "food_logs", userId),
    count(admin, "subjective_checkins", userId),
    count(admin, "evening_reviews", userId),
    count(admin, "body_measurements", userId),
    admin.from("user_birds").select("species_key, source").eq("user_id", userId).returns<{ species_key: string | null; source: string }[]>(),
  ]);

  const list = birds ?? [];
  const photoBirds = list.filter((b) => b.source === "photo").length;
  const hatchedSpecies = new Set(list.filter((b) => b.source !== "photo" && b.species_key).map((b) => b.species_key));
  const species = hatchedSpecies.size + photoBirds; // each photographed bird is its own species

  return { seeds, streak, habitDone, birds: list.length, species, photoBirds, foods, checkins, reviews, weights };
}
