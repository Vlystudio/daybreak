"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { ACCESSORY_BY_KEY, DECOR_BY_KEY } from "@/lib/game/shop";

type Res = { ok: true; seeds?: number } | { ok: false; error: string };

/** Buy a cosmetic accessory (one of each is enough to equip on any bird). */
export async function buyAccessory(key: string): Promise<Res> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const item = ACCESSORY_BY_KEY[key];
  if (!item) return { ok: false, error: "No such accessory." };

  const admin = createAdminClient();
  const { data: game } = await admin.from("user_game").select("seeds").eq("user_id", user.id).maybeSingle<{ seeds: number }>();
  const seeds = game?.seeds ?? 0;
  const { data: inv } = await admin.from("user_inventory").select("qty").eq("user_id", user.id).eq("item_key", item.key).maybeSingle<{ qty: number }>();
  if ((inv?.qty ?? 0) > 0) return { ok: false, error: "You already own that one." };
  if (seeds < item.cost) return { ok: false, error: `You need ${item.cost - seeds} more seeds.` };

  await admin.from("user_game").update({ seeds: seeds - item.cost }).eq("user_id", user.id);
  await admin.from("user_inventory").upsert({ user_id: user.id, item_key: item.key, qty: 1, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_key" });
  await audit(user.id, "shop.buy", { metadata: { item: item.key, kind: "accessory" } });
  revalidatePath("/nest");
  return { ok: true, seeds: seeds - item.cost };
}

/** Put an owned accessory on a bird (or pass null to take it off). */
export async function equipAccessory(birdId: string, key: string | null): Promise<Res> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(birdId).success) return { ok: false, error: "Unknown bird." };
  if (key !== null && !ACCESSORY_BY_KEY[key]) return { ok: false, error: "No such accessory." };

  const admin = createAdminClient();
  const { data: bird } = await admin.from("user_birds").select("id").eq("id", birdId).eq("user_id", user.id).maybeSingle<{ id: string }>();
  if (!bird) return { ok: false, error: "That bird isn't in your aviary." };

  if (key) {
    const { data: inv } = await admin.from("user_inventory").select("qty").eq("user_id", user.id).eq("item_key", key).maybeSingle<{ qty: number }>();
    if (!inv || inv.qty < 1) return { ok: false, error: "You don't own that accessory yet." };
  }

  await admin.from("user_birds").update({ accessory: key }).eq("id", birdId);
  await audit(user.id, "shop.equip", { metadata: { bird: birdId, accessory: key ?? "none" } });
  revalidatePath("/nest");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Buy a decor item and place it around the nest. */
export async function buyDecor(key: string): Promise<Res> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const item = DECOR_BY_KEY[key];
  if (!item) return { ok: false, error: "No such decoration." };

  const admin = createAdminClient();
  const { data: game } = await admin.from("user_game").select("seeds, decor").eq("user_id", user.id).maybeSingle<{ seeds: number; decor: string[] }>();
  const seeds = game?.seeds ?? 0;
  const decor = game?.decor ?? [];
  if (decor.includes(item.key)) return { ok: false, error: "That's already in your nest." };
  if (seeds < item.cost) return { ok: false, error: `You need ${item.cost - seeds} more seeds.` };

  await admin.from("user_game").update({ seeds: seeds - item.cost, decor: [...decor, item.key] }).eq("user_id", user.id);
  await audit(user.id, "shop.buy", { metadata: { item: item.key, kind: "decor" } });
  revalidatePath("/nest");
  return { ok: true, seeds: seeds - item.cost };
}
