"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { FOOD_BY_KEY, canEat, dietLabel } from "@/lib/game/shop";
import { LEGACY_KEY_MAP, SPECIES_BY_KEY } from "@/lib/game/birds";

type BuyResult = { ok: true; seeds: number; qty: number } | { ok: false; error: string };

/** Spend seeds to stock up on a food item. */
export async function buyFood(itemKey: string, quantity = 1): Promise<BuyResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const parsed = z.object({ itemKey: z.string(), qty: z.number().int().min(1).max(50) }).safeParse({ itemKey, qty: quantity });
  if (!parsed.success) return { ok: false, error: "Invalid purchase." };
  const food = FOOD_BY_KEY[parsed.data.itemKey];
  if (!food) return { ok: false, error: "No such item." };

  const admin = createAdminClient();
  const { data: game } = await admin.from("user_game").select("seeds").eq("user_id", user.id).maybeSingle<{ seeds: number }>();
  const seeds = game?.seeds ?? 0;
  const cost = food.cost * parsed.data.qty;
  if (seeds < cost) return { ok: false, error: `You need ${cost - seeds} more seeds.` };

  const { data: inv } = await admin.from("user_inventory").select("qty").eq("user_id", user.id).eq("item_key", food.key).maybeSingle<{ qty: number }>();
  const newQty = (inv?.qty ?? 0) + parsed.data.qty;

  await admin.from("user_game").update({ seeds: seeds - cost }).eq("user_id", user.id);
  await admin.from("user_inventory").upsert({ user_id: user.id, item_key: food.key, qty: newQty, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_key" });

  await audit(user.id, "shop.buy", { metadata: { item: food.key, qty: parsed.data.qty, cost } });
  revalidatePath("/nest");
  return { ok: true, seeds: seeds - cost, qty: newQty };
}

type FeedResult = { ok: true; happiness: number; xp: number; message: string } | { ok: false; error: string };

/** Feed a bird — only foods in its species' real diet are allowed. */
export async function feedBird(birdId: string, itemKey: string): Promise<FeedResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  if (!uuidSchema.safeParse(birdId).success) return { ok: false, error: "Unknown bird." };
  const food = FOOD_BY_KEY[itemKey];
  if (!food) return { ok: false, error: "No such food." };

  const admin = createAdminClient();
  const { data: bird } = await admin
    .from("user_birds")
    .select("id, species_key, source, custom_name, happiness, xp")
    .eq("id", birdId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; species_key: string | null; source: string; custom_name: string | null; happiness: number; xp: number }>();
  if (!bird) return { ok: false, error: "That bird isn't in your aviary." };

  // Diet key: wild/photo birds use the generalist diet; hatched use their (de-aliased) species.
  const dietKey = bird.source === "photo" ? null : LEGACY_KEY_MAP[bird.species_key ?? ""] ?? bird.species_key;
  const name = bird.custom_name || (dietKey ? SPECIES_BY_KEY[dietKey]?.name : null) || "Your bird";

  if (!canEat(dietKey, food.key)) {
    return { ok: false, error: `${name} doesn't eat ${food.name.toLowerCase()}. It eats ${dietLabel(dietKey)}.` };
  }

  const { data: inv } = await admin.from("user_inventory").select("qty").eq("user_id", user.id).eq("item_key", food.key).maybeSingle<{ qty: number }>();
  if (!inv || inv.qty < 1) return { ok: false, error: `You're out of ${food.name}. Buy some in the shop.` };

  const happiness = Math.min(100, (bird.happiness ?? 60) + food.happiness);
  const xp = (bird.xp ?? 0) + food.xp;

  await admin.from("user_inventory").update({ qty: inv.qty - 1, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("item_key", food.key);
  await admin.from("user_birds").update({ happiness, xp, last_fed_at: new Date().toISOString() }).eq("id", bird.id);

  await audit(user.id, "shop.feed", { metadata: { bird: bird.id, item: food.key } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true, happiness, xp, message: `${name} happily ate the ${food.name.toLowerCase()}! ${food.emoji}` };
}
