"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { rollSpecies } from "@/lib/game/birds";
import { identifyBird, type BirdIdentification } from "@/lib/integrations/bird-identify";
import { validateImageDataUrl } from "@/lib/image-upload";
import { SEED_COST_EGG } from "@/lib/game/rewards";

export type HatchResult =
  | { ok: true; speciesKey: string; speciesName: string; rarity: string; birdId: string }
  | { ok: false; error: string };

/** Spend seeds to hatch a random bird into the aviary. */
export async function hatchEgg(): Promise<HatchResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const admin = createAdminClient();
  const { data: game } = await admin
    .from("user_game")
    .select("seeds, active_bird_id, free_hatches")
    .eq("user_id", user.id)
    .maybeSingle<{ seeds: number; active_bird_id: string | null; free_hatches: number }>();

  const seeds = game?.seeds ?? 0;
  const freeHatches = game?.free_hatches ?? 0;
  const useFree = freeHatches > 0;
  if (!useFree && seeds < SEED_COST_EGG) {
    return { ok: false, error: `You need ${SEED_COST_EGG} seeds to hatch an egg.` };
  }

  const species = rollSpecies();
  const { data: bird, error } = await admin
    .from("user_birds")
    .insert({ user_id: user.id, species_key: species.key })
    .select("id")
    .single<{ id: string }>();
  if (error || !bird) return { ok: false, error: "The egg didn't hatch — try again." };

  await admin
    .from("user_game")
    .update({
      // A banked free egg costs no seeds.
      ...(useFree ? { free_hatches: freeHatches - 1 } : { seeds: seeds - SEED_COST_EGG }),
      // Adopt the first bird as the companion automatically.
      ...(game?.active_bird_id ? {} : { active_bird_id: bird.id }),
    })
    .eq("user_id", user.id);

  await audit(user.id, "game.hatched", {
    metadata: { species: species.key, rarity: species.rarity, free: useFree },
  });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return {
    ok: true,
    speciesKey: species.key,
    speciesName: species.name,
    rarity: species.rarity,
    birdId: bird.id,
  };
}

/**
 * Starter ceremony: hatch the new user's first bird and bank one free egg (the
 * second egg they chose to keep). One-time — guarded by starter_done.
 */
export async function claimStarter(): Promise<HatchResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "One moment…" };

  const admin = createAdminClient();
  const { data: game } = await admin
    .from("user_game")
    .select("starter_done, active_bird_id")
    .eq("user_id", user.id)
    .maybeSingle<{ starter_done: boolean; active_bird_id: string | null }>();
  if (game?.starter_done) return { ok: false, error: "You've already chosen your starter eggs." };

  const species = rollSpecies();
  const { data: bird, error } = await admin
    .from("user_birds")
    .insert({ user_id: user.id, species_key: species.key })
    .select("id")
    .single<{ id: string }>();
  if (error || !bird) return { ok: false, error: "The egg didn't hatch — try again." };

  const update = {
    starter_done: true,
    free_hatches: 1,
    active_bird_id: game?.active_bird_id ?? bird.id,
  };
  if (game) await admin.from("user_game").update(update).eq("user_id", user.id);
  else await admin.from("user_game").insert({ user_id: user.id, ...update });

  await audit(user.id, "game.hatched", { metadata: { species: species.key, starter: true } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return {
    ok: true,
    speciesKey: species.key,
    speciesName: species.name,
    rarity: species.rarity,
    birdId: bird.id,
  };
}

export type PhotoBirdResult =
  | { ok: true; id: string; identification: BirdIdentification }
  | { ok: false; error: string };

/** Identify a real bird from a photo and keep it as a collectible (free). */
export async function addBirdFromPhoto(input: { imageDataUrl: string }): Promise<PhotoBirdResult> {
  const user = await requireUser();
  const limited = await rateLimit(`vision:${user.id}`, RATE_LIMITS.aiVision);
  if (!limited.ok) return { ok: false, error: "You've added a lot of birds — try again in a bit." };

  const valid = validateImageDataUrl(input.imageDataUrl);
  if (!valid.ok) return { ok: false, error: valid.error };

  const id = await identifyBird(input.imageDataUrl);
  if (!id) return { ok: false, error: "Couldn't read that photo — try another one." };
  if (!id.isBird)
    return { ok: false, error: "Hmm, that doesn't look like a bird. Try a clearer photo of one." };

  const admin = createAdminClient();
  const { data: bird, error } = await admin
    .from("user_birds")
    .insert({
      user_id: user.id,
      species_key: null,
      source: "photo",
      custom_name: id.name,
      custom_blurb: id.blurb,
      custom_palette: id.palette,
      custom_crest: id.crest,
      custom_long_tail: id.longTail,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !bird) return { ok: false, error: "Couldn't add that bird — try again." };

  const { data: game } = await admin
    .from("user_game")
    .select("active_bird_id")
    .eq("user_id", user.id)
    .maybeSingle<{ active_bird_id: string | null }>();
  if (!game) await admin.from("user_game").insert({ user_id: user.id, active_bird_id: bird.id });
  else if (!game.active_bird_id)
    await admin.from("user_game").update({ active_bird_id: bird.id }).eq("user_id", user.id);

  await audit(user.id, "game.hatched", { metadata: { source: "photo", name: id.name } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true, id: bird.id, identification: id };
}

export async function setActiveBird(birdId: string): Promise<{ ok: boolean; error?: string }> {
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

/** Pet the companion: a tiny once-a-day affection bonus + XP. */
export async function petBird(): Promise<{ ok: boolean; seeds?: number; error?: string }> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const tz = profile?.timezone ?? "UTC";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: inserted, error: ledgerErr } = await admin
    .from("reward_ledger")
    .upsert(
      { user_id: user.id, key: `${today}|pet`, source: "pet", amount: 2, awarded_on: today },
      { onConflict: "user_id,key", ignoreDuplicates: true }
    )
    .select("amount")
    .returns<{ amount: number }[]>();
  if (ledgerErr) return { ok: false, error: "Couldn't reach your nest just now." };

  const bonus = (inserted ?? []).reduce((s, r) => s + r.amount, 0);
  if (bonus > 0) {
    const { data: game } = await admin
      .from("user_game")
      .select("seeds, total_earned, active_bird_id")
      .eq("user_id", user.id)
      .maybeSingle<{ seeds: number; total_earned: number; active_bird_id: string | null }>();
    if (game) {
      await admin
        .from("user_game")
        .update({ seeds: game.seeds + bonus, total_earned: game.total_earned + bonus })
        .eq("user_id", user.id);
      if (game.active_bird_id) {
        const { data: b } = await admin
          .from("user_birds")
          .select("xp")
          .eq("id", game.active_bird_id)
          .maybeSingle<{ xp: number }>();
        if (b)
          await admin
            .from("user_birds")
            .update({ xp: b.xp + 4 })
            .eq("id", game.active_bird_id);
      }
    }
    revalidatePath("/nest");
  }
  return { ok: true, seeds: bonus };
}
