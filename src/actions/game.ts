"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { securityRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { rollSpecies, resolveSpecies, sellValueFor, type OwnedBirdBase } from "@/lib/game/birds";
import { SEED_COST_EGG } from "@/lib/game/rewards";
import { NEST_ENABLED } from "@/lib/features";

const NEST_DISABLED_ERROR = "Nest is not available in this release.";

/**
 * Game economy server actions. Every balance change runs inside a Postgres RPC
 * that locks the wallet row (SELECT ... FOR UPDATE) and validates rules in-DB, so
 * concurrent requests can't overspend, double-credit, or lose updates. The
 * actions stay thin: authenticate → security rate limit → call RPC → audit →
 * revalidate. Seeds are NEVER computed in TypeScript. The RPCs are EXECUTE-locked
 * to the service role, so only these server actions (which derive p_user_id from
 * the session) can invoke them.
 */

export type HatchResult =
  | { ok: true; speciesKey: string; speciesName: string; rarity: string; birdId: string }
  | { ok: false; error: string };

/** YYYY-MM-DD for "now" in the given IANA timezone. */
function localDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Spend seeds (or a banked free egg) to hatch a random bird — atomically. */
export async function hatchEgg(): Promise<HatchResult> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  const limited = await securityRateLimit(`hatch:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const species = rollSpecies();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hatch_egg_for_user", {
    p_user_id: user.id,
    p_species_key: species.key,
    p_rarity: species.rarity,
    p_cost: SEED_COST_EGG,
  });
  if (error) {
    if (error.message.includes("insufficient_seeds")) {
      return { ok: false, error: `You need ${SEED_COST_EGG} seeds to hatch an egg.` };
    }
    return { ok: false, error: "The egg didn't hatch — try again." };
  }
  const row = (data as { bird_id: string; used_free: boolean }[] | null)?.[0];
  if (!row) return { ok: false, error: "The egg didn't hatch — try again." };

  await audit(user.id, "game.hatched", {
    metadata: { species: species.key, rarity: species.rarity, free: row.used_free },
  });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return {
    ok: true,
    speciesKey: species.key,
    speciesName: species.name,
    rarity: species.rarity,
    birdId: row.bird_id,
  };
}

/**
 * Starter ceremony: hatch the new user's first bird and bank one free egg.
 * One-time — guarded by starter_done inside the RPC.
 */
export async function claimStarter(): Promise<HatchResult> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  const limited = await securityRateLimit(`starter:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "One moment…" };

  const species = rollSpecies();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_starter_bird_for_user", {
    p_user_id: user.id,
    p_species_key: species.key,
    p_rarity: species.rarity,
  });
  if (error) {
    if (error.message.includes("already_done")) {
      return { ok: false, error: "You've already chosen your starter eggs." };
    }
    return { ok: false, error: "The egg didn't hatch — try again." };
  }
  const row = (data as { bird_id: string }[] | null)?.[0];
  if (!row) return { ok: false, error: "The egg didn't hatch — try again." };

  await audit(user.id, "game.hatched", { metadata: { species: species.key, starter: true } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return {
    ok: true,
    speciesKey: species.key,
    speciesName: species.name,
    rarity: species.rarity,
    birdId: row.bird_id,
  };
}

export type SellResult =
  | { ok: true; value: number; speciesName: string; seeds: number }
  | { ok: false; error: string };

/** The bird columns needed to resolve a species + fallback rarity. */
type SellableBirdRow = OwnedBirdBase & { id: string };

/**
 * Sell one bird for seeds based on its rarity. Ownership, the active-bird and
 * last-bird rules, the delete, and the credit all happen atomically inside the
 * RPC under the wallet lock — so a double-tap can't mint seeds twice and
 * concurrent sells can't lose a credit. The value is computed in-DB from a
 * trusted rarity mapping, never from client input.
 */
export async function sellBird(birdId: string): Promise<SellResult> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  const limited = await securityRateLimit(`sell:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };
  if (!uuidSchema.safeParse(birdId).success) return { ok: false, error: "Unknown bird" };

  const admin = createAdminClient();
  // Resolve the species (server-trusted catalog) for the display name and a
  // fallback rarity for pre-migration birds whose row has no stored rarity yet.
  const { data: bird } = await admin
    .from("user_birds")
    .select(
      "id, species_key, source, custom_name, custom_blurb, custom_palette, custom_crest, custom_long_tail"
    )
    .eq("id", birdId)
    .eq("user_id", user.id)
    .maybeSingle<SellableBirdRow>();
  if (!bird) return { ok: false, error: "That bird isn't in your aviary." };
  const species = resolveSpecies(bird);

  const { data, error } = await admin.rpc("sell_bird_for_user", {
    p_user_id: user.id,
    p_bird_id: birdId,
    p_fallback_rarity: species.rarity,
  });
  if (error) {
    if (error.message.includes("last_bird")) {
      return { ok: false, error: "This is your last bird — keep it close." };
    }
    if (error.message.includes("active_bird")) {
      return { ok: false, error: "Make another bird your companion before selling this one." };
    }
    if (error.message.includes("not_found")) {
      return { ok: false, error: "That bird was already sold." };
    }
    return { ok: false, error: "Couldn't sell that bird — try again." };
  }
  const row = (data as { value: number; seeds: number }[] | null)?.[0];
  const value = row?.value ?? sellValueFor(species.rarity);

  await audit(user.id, "game.sold", {
    metadata: { species: species.key, rarity: species.rarity, value },
  });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true, value, speciesName: species.name, seeds: row?.seeds ?? 0 };
}

export async function setActiveBird(birdId: string): Promise<{ ok: boolean; error?: string }> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  if (!uuidSchema.safeParse(birdId).success) return { ok: false, error: "Unknown bird" };

  const admin = createAdminClient();
  const { data: bird } = await admin
    .from("user_birds")
    .select("id")
    .eq("id", birdId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!bird) return { ok: false, error: "That bird isn't in your aviary." };

  await admin.from("user_game").update({ active_bird_id: birdId }).eq("user_id", user.id);
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function renameBird(
  birdId: string,
  nickname: string
): Promise<{ ok: boolean; error?: string }> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  const parsed = z
    .object({ id: uuidSchema, nickname: z.string().trim().max(40) })
    .safeParse({ id: birdId, nickname });
  if (!parsed.success) return { ok: false, error: "Invalid name" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_birds")
    .update({ nickname: parsed.data.nickname.length ? parsed.data.nickname : null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't rename that bird." };

  revalidatePath("/nest");
  return { ok: true };
}

/** Pet the companion: a tiny once-a-day affection bonus + XP, granted atomically. */
export async function petBird(): Promise<{ ok: boolean; seeds?: number; error?: string }> {
  if (!NEST_ENABLED) return { ok: false, error: NEST_DISABLED_ERROR };
  const user = await requireUser();
  const limited = await securityRateLimit(`pet:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "One moment…" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const today = localDate(profile?.timezone ?? "UTC");

  const { data, error } = await admin.rpc("pet_bird_for_user", {
    p_user_id: user.id,
    p_local_date: today,
  });
  if (error) return { ok: false, error: "Couldn't reach your nest just now." };

  const bonus = (data as { bonus: number; seeds: number }[] | null)?.[0]?.bonus ?? 0;
  if (bonus > 0) revalidatePath("/nest");
  return { ok: true, seeds: bonus };
}
