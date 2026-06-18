"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import { productPriceSchema, shoppingListItemSchema, type ProductPriceInput, type ShoppingListItemInput, type ShoppingItemStatus, SHOPPING_ITEM_STATUSES } from "@/lib/grocery";
import type { ActionResult } from "@/actions/schedule";

async function householdId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle<{ household_id: string }>();
  return data?.household_id ?? null;
}

// ── Community price entry ────────────────────────────────────────────────────
export async function addProductPrice(input: ProductPriceInput): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many entries — try again shortly." };

  const parsed = productPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid price" };
  const d = parsed.data;
  if (d.salePrice != null && d.salePrice > d.price) {
    return { ok: false, error: "Sale price can't be higher than the regular price." };
  }

  const supabase = await createClient();

  // Reuse an existing catalog product with the same name, else create one.
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .ilike("name", d.productName)
    .limit(1)
    .maybeSingle<{ id: string }>();

  let productId = existing?.id ?? null;
  if (!productId) {
    const { data: created, error: createErr } = await supabase
      .from("products")
      .insert({ name: d.productName, brand: d.brand || null, created_by: user.id })
      .select("id")
      .single<{ id: string }>();
    if (createErr || !created) return { ok: false, error: "Couldn't save that product." };
    productId = created.id;
  }

  const { error } = await supabase.from("product_prices").insert({
    product_id: productId,
    store_id: d.storeId,
    price: d.price,
    sale_price: d.salePrice ?? null,
    unit: d.unit || null,
    package_size: d.packageSize || null,
    source_key: "manual",
    is_estimated: false,
    recorded_by: user.id,
  });
  if (error) return { ok: false, error: "Couldn't save that price." };

  await audit(user.id, "price.added");
  revalidatePath("/grocery/prices");
  return { ok: true };
}

// ── Shopping lists ───────────────────────────────────────────────────────────
export async function createShoppingList(
  title?: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const supabase = await createClient();
  const hh = await householdId(supabase, user.id);
  const clean = (title ?? "").trim().slice(0, 120) || null;

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: user.id, household_id: hh, title: clean })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: "Couldn't create the list." };

  await audit(user.id, "shopping_list.created");
  revalidatePath("/grocery/lists");
  return { ok: true, id: data.id };
}

export async function deleteShoppingList(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid list" };

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_lists").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't delete the list." };

  revalidatePath("/grocery/lists");
  return { ok: true };
}

export async function addShoppingListItem(input: ShoppingListItemInput): Promise<ActionResult> {
  await requireUser();
  const parsed = shoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  const d = parsed.data;

  const supabase = await createClient();
  // RLS ensures the list belongs to the user / their household.
  const { error } = await supabase.from("shopping_list_items").insert({
    shopping_list_id: d.shoppingListId,
    name: d.name,
    quantity: d.quantity ?? 1,
    unit: d.unit || null,
  });
  if (error) return { ok: false, error: "Couldn't add the item." };

  revalidatePath(`/grocery/lists/${d.shoppingListId}`);
  return { ok: true };
}

export async function setShoppingItemStatus(id: string, status: ShoppingItemStatus): Promise<ActionResult> {
  await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid item" };
  if (!SHOPPING_ITEM_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .update({ status })
    .eq("id", id)
    .select("shopping_list_id")
    .maybeSingle<{ shopping_list_id: string }>();
  if (error) return { ok: false, error: "Couldn't update the item." };

  if (data) revalidatePath(`/grocery/lists/${data.shopping_list_id}`);
  return { ok: true };
}

export async function removeShoppingListItem(id: string): Promise<ActionResult> {
  await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid item" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", id)
    .select("shopping_list_id")
    .maybeSingle<{ shopping_list_id: string }>();
  if (error) return { ok: false, error: "Couldn't remove the item." };

  if (data) revalidatePath(`/grocery/lists/${data.shopping_list_id}`);
  return { ok: true };
}
