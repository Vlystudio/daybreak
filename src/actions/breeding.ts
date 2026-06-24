"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { rollSpecies, SPECIES_BY_KEY, BIRD_SPECIES, LEGACY_KEY_MAP, type Rarity } from "@/lib/game/birds";
import { EGG_INCUBATION_MIN, MAX_EGGS } from "@/lib/game/shop";

function resolveKey(k: string | null): string | null {
  if (!k) return null;
  return LEGACY_KEY_MAP[k] ?? k;
}

/** Luck-based offspring: usually one of the parents' species, sometimes a wild surprise (which can be rarer). */
function rollOffspring(aKey: string | null, bKey: string | null, rng: () => number = Math.random): { speciesKey: string; rarity: Rarity } {
  const a = resolveKey(aKey);
  const b = resolveKey(bKey);
  const r = rng();
  let key: string;
  if (a && r < 0.45) key = a;
  else if (b && r < 0.9) key = b;
  else key = rollSpecies(rng).key; // ~10% "mutation" — the lucky chance at something new/rarer
  const sp = SPECIES_BY_KEY[key] ?? BIRD_SPECIES[0];
  return { speciesKey: sp.key, rarity: sp.rarity };
}

type MateResult = { ok: true; hatchAt: string } | { ok: false; error: string };

/** Pair two birds; they lay an egg that hatches after an incubation timer. */
export async function mateBirds(birdAId: string, birdBId: string): Promise<MateResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  if (!uuidSchema.safeParse(birdAId).success || !uuidSchema.safeParse(birdBId).success) return { ok: false, error: "Unknown bird." };
  if (birdAId === birdBId) return { ok: false, error: "A bird can't pair with itself — pick two different birds." };

  const admin = createAdminClient();
  const { data: birds } = await admin.from("user_birds").select("id, species_key").in("id", [birdAId, birdBId]).eq("user_id", user.id).returns<{ id: string; species_key: string | null }[]>();
  if (!birds || birds.length !== 2) return { ok: false, error: "Both birds must be in your aviary." };

  const { count } = await admin.from("user_eggs").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX_EGGS) return { ok: false, error: `Your nursery is full (max ${MAX_EGGS} eggs). Hatch one first.` };

  const a = birds.find((x) => x.id === birdAId)!;
  const b = birds.find((x) => x.id === birdBId)!;
  const { speciesKey, rarity } = rollOffspring(a.species_key, b.species_key);
  const hatchAt = new Date(Date.now() + EGG_INCUBATION_MIN * 60_000).toISOString();

  const { error } = await admin.from("user_eggs").insert({ user_id: user.id, parent_a: a.id, parent_b: b.id, species_key: speciesKey, rarity, hatch_at: hatchAt });
  if (error) return { ok: false, error: "Couldn't pair them — try again." };

  await audit(user.id, "game.bred", { metadata: { a: a.id, b: b.id } });
  revalidatePath("/nest");
  return { ok: true, hatchAt };
}

type HatchResult = { ok: true; speciesKey: string; speciesName: string; rarity: string } | { ok: false; error: string };

/** Hatch a ready egg into a new bird. */
export async function hatchBredEgg(eggId: string): Promise<HatchResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "One moment…" };
  if (!uuidSchema.safeParse(eggId).success) return { ok: false, error: "Unknown egg." };

  const admin = createAdminClient();
  const { data: egg } = await admin.from("user_eggs").select("id, species_key, rarity, hatch_at").eq("id", eggId).eq("user_id", user.id).maybeSingle<{ id: string; species_key: string; rarity: string; hatch_at: string }>();
  if (!egg) return { ok: false, error: "That egg isn't in your nursery." };
  if (new Date(egg.hatch_at).getTime() > Date.now()) return { ok: false, error: "This egg is still incubating." };

  const { data: bird, error } = await admin.from("user_birds").insert({ user_id: user.id, species_key: egg.species_key }).select("id").single<{ id: string }>();
  if (error || !bird) return { ok: false, error: "The egg didn't hatch — try again." };
  await admin.from("user_eggs").delete().eq("id", egg.id);

  const sp = SPECIES_BY_KEY[egg.species_key] ?? BIRD_SPECIES[0];
  await audit(user.id, "game.hatched", { metadata: { species: sp.key, bred: true } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true, speciesKey: sp.key, speciesName: sp.name, rarity: sp.rarity };
}
