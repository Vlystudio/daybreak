import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePrice, normalizeIngredientName } from "@/lib/grocery";
import type { OptimizerItem, PriceOption } from "@/lib/grocery/optimizer";

/**
 * Turns shopping-list items into priced OptimizerItems by matching their names
 * against recorded product_prices at a set of stores. Names are normalized for
 * fuzzy matching ("Organic Chicken Breast" -> "chicken breast"). Reads use the
 * admin client because prices are a shared/public catalog (RLS: read = true).
 */

interface PriceRow {
  store_id: string | null;
  price: number | null;
  sale_price: number | null;
  is_estimated: boolean;
  recorded_at: string;
  products: { name: string } | null;
}

export interface PricedStore {
  id: string;
  name: string;
}

type StorePriceMap = Map<string, { price: number; isEstimated: boolean }>;

export async function buildOptimizerItems(
  items: { name: string; quantity: number }[],
  stores: PricedStore[]
): Promise<OptimizerItem[]> {
  if (items.length === 0 || stores.length === 0) {
    return items.map((it) => ({ name: it.name, quantity: it.quantity, options: [] }));
  }

  const admin = createAdminClient();
  const storeIds = stores.map((s) => s.id);
  const nameById = new Map(stores.map((s) => [s.id, s.name] as const));

  const { data } = await admin
    .from("product_prices")
    .select("store_id, price, sale_price, is_estimated, recorded_at, products(name)")
    .in("store_id", storeIds)
    .order("recorded_at", { ascending: false })
    .limit(1000)
    .returns<PriceRow[]>();

  // storeId -> (normalized product name -> cheapest effective price seen).
  const byStore = new Map<string, StorePriceMap>();
  for (const r of data ?? []) {
    if (!r.store_id || !r.products) continue;
    const eff = effectivePrice({ price: r.price, sale_price: r.sale_price });
    if (eff == null) continue;
    const norm = normalizeIngredientName(r.products.name);
    if (!norm) continue;
    let store = byStore.get(r.store_id);
    if (!store) {
      store = new Map();
      byStore.set(r.store_id, store);
    }
    const prev = store.get(norm);
    if (!prev || eff < prev.price) store.set(norm, { price: eff, isEstimated: r.is_estimated });
  }

  return items.map((it) => {
    const norm = normalizeIngredientName(it.name);
    const options: PriceOption[] = [];
    for (const s of stores) {
      const store = byStore.get(s.id);
      if (!store) continue;
      let match = norm ? store.get(norm) : undefined;
      if (!match && norm) {
        for (const [pname, val] of store) {
          if (pname.includes(norm) || norm.includes(pname)) {
            match = val;
            break;
          }
        }
      }
      if (match) {
        options.push({
          storeId: s.id,
          storeName: nameById.get(s.id) ?? s.name,
          price: match.price,
          isEstimated: match.isEstimated,
        });
      }
    }
    return { name: it.name, quantity: it.quantity, options };
  });
}
