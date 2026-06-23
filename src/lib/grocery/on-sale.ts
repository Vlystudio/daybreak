import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIngredientName } from "@/lib/grocery";

/**
 * Helpers over the imported deal catalog (product_prices, source_key='web').
 * Used to bias meal planning toward what's on sale and to alert users when their
 * favorite items are discounted.
 */

interface DealRow {
  store_id: string | null;
  sale_expires: string | null;
  products: { name: string } | null;
  stores: { name: string } | null;
}

async function activeDeals(limit = 1500): Promise<DealRow[]> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("product_prices")
    .select("store_id, sale_expires, products(name), stores(name)")
    .eq("source_key", "web")
    .or(`sale_expires.is.null,sale_expires.gte.${today}`)
    .order("recorded_at", { ascending: false })
    .limit(limit)
    .returns<DealRow[]>();
  return data ?? [];
}

/** Distinct on-sale product names, for seeding the meal-plan prompt. */
export async function getOnSaleItems(max = 40): Promise<string[]> {
  const deals = await activeDeals();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of deals) {
    const name = d.products?.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export interface DealMatch {
  favorite: string;
  product: string;
  store: string | null;
}

/** Match a user's favorite ingredient names against the active deals. */
export function matchFavoritesToDeals(favorites: string[], deals: DealRow[]): DealMatch[] {
  const matches: DealMatch[] = [];
  const seen = new Set<string>();
  for (const fav of favorites) {
    const nf = normalizeIngredientName(fav);
    if (!nf) continue;
    for (const d of deals) {
      const product = d.products?.name;
      if (!product) continue;
      const np = normalizeIngredientName(product);
      if (np && (np.includes(nf) || nf.includes(np))) {
        if (seen.has(fav)) break;
        seen.add(fav);
        matches.push({ favorite: fav, product, store: d.stores?.name ?? null });
        break;
      }
    }
  }
  return matches;
}

export { activeDeals };
