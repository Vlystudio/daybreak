"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import {
  grocerySettingsSchema,
  pantryItemSchema,
  type GrocerySettingsInput,
  type PantryItemInput,
} from "@/lib/grocery";
import { importGroceryDeals } from "@/lib/grocery/import-deals";
import { integrationsAvailable } from "@/env";
import type { ActionResult } from "@/actions/schedule";

async function householdId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle<{ household_id: string }>();
  return data?.household_id ?? null;
}

export async function saveGrocerySettings(input: GrocerySettingsInput): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = grocerySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("grocery_settings").upsert(
    {
      user_id: user.id,
      weekly_budget: d.weeklyBudget ?? null,
      household_size: d.householdSize,
      max_stores_per_trip: d.maxStoresPerTrip,
      max_distance_miles: d.maxDistanceMiles ?? null,
      favorites: d.favorites,
      dislikes: d.dislikes,
      allergies: d.allergies,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: "Couldn't save settings." };

  await audit(user.id, "grocery.settings_updated");
  revalidatePath("/grocery");
  return { ok: true };
}

export async function addPantryItem(input: PantryItemInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = pantryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  const d = parsed.data;

  const supabase = await createClient();
  const hh = await householdId(supabase, user.id);
  const { error } = await supabase.from("pantry_items").insert({
    user_id: user.id,
    household_id: hh,
    name: d.name,
    quantity: d.quantity ?? null,
    unit: d.unit || null,
    location: d.location,
    expiration_date: d.expirationDate || null,
  });
  if (error) return { ok: false, error: "Couldn't add the item." };

  await audit(user.id, "pantry.updated", { metadata: { action: "add" } });
  revalidatePath("/grocery/pantry");
  return { ok: true };
}

export async function removePantryItem(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid item" };

  const supabase = await createClient();
  // RLS limits deletes to the user's own / household rows.
  const { error } = await supabase.from("pantry_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove the item." };

  await audit(user.id, "pantry.updated", { metadata: { action: "remove" } });
  revalidatePath("/grocery/pantry");
  return { ok: true };
}

/**
 * Pull the latest discounts from the external grocery-deals feed into the
 * shared price catalog. Global (affects everyone's optimizer); rate-limited.
 */
export async function refreshGroceryDeals(): Promise<{ ok: true; prices: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!integrationsAvailable.groceryDeals()) {
    return { ok: false, error: "The deals feed isn't connected on this deployment." };
  }

  const limited = await rateLimit(`sync:${user.id}`, RATE_LIMITS.sync);
  if (!limited.ok) return { ok: false, error: "Deals were refreshed recently — they update automatically too." };

  try {
    const result = await importGroceryDeals();
    if (!result) return { ok: false, error: "Couldn't reach the deals feed — try again shortly." };
    await audit(user.id, "deals.imported", { metadata: { prices: result.prices, stores: result.stores } });
    revalidatePath("/grocery/prices");
    revalidatePath("/grocery");
    return { ok: true, prices: result.prices };
  } catch (err) {
    console.error("[grocery] deal import failed:", err);
    return { ok: false, error: "The deal import hit a snag — please try again." };
  }
}

/** Toggle a store on/off in the user's preferred-store list. */
export async function toggleStore(storeId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(storeId).success) return { ok: false, error: "Invalid store" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_stores")
    .select("id")
    .eq("user_id", user.id)
    .eq("store_id", storeId)
    .is("store_location_id", null)
    .maybeSingle<{ id: string }>();

  if (existing) {
    await supabase.from("user_stores").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase.from("user_stores").insert({ user_id: user.id, store_id: storeId });
    if (error) return { ok: false, error: "Couldn't update stores." };
  }

  revalidatePath("/grocery");
  return { ok: true };
}
