import "server-only";
import { serverEnv, integrationsAvailable } from "@/env";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { isProcessorEnabled } from "@/lib/privacy/processors";

/**
 * Reads the external grocery-deals feed (the "grocerytracker" Supabase project)
 * over its public PostgREST API with the anon key. Only currently-valid deals
 * with a real price are returned. No-ops when the feed isn't configured.
 */

export interface GroceryDeal {
  storeName: string;
  postalCode: string | null;
  productName: string;
  brand: string | null;
  price: number;
  discount: string | null;
  validTo: string | null;
}

interface DealRow {
  product_name: string | null;
  brand: string | null;
  store: string | null;
  merchant_raw: string | null;
  price: number | null;
  discount: string | null;
  valid_to: string | null;
  postal_code: string | null;
}

export async function fetchActiveDeals(limit = 5000): Promise<GroceryDeal[] | null> {
  if (!integrationsAvailable.groceryDeals() || !isProcessorEnabled("grocerytracker")) return null;
  const base = serverEnv().GROCERYTRACKER_URL!.replace(/\/$/, "");
  const key = serverEnv().GROCERYTRACKER_ANON_KEY!;

  const params = new URLSearchParams({
    select: "product_name,brand,store,merchant_raw,price,discount,valid_to,postal_code",
    valid_to: `gte.${new Date().toISOString()}`,
    price: "not.is.null",
    order: "retrieved_at.desc",
    limit: String(limit),
  });

  try {
    const res = await fetch(`${base}/rest/v1/grocery_deals?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      safeLog("error", "grocery_deals.feed_failed", { status: res.status });
      return null;
    }
    const rows = (await res.json()) as DealRow[];
    return rows
      .map((r): GroceryDeal | null => {
        const name = r.product_name?.trim();
        const store = (r.store || r.merchant_raw || "").trim();
        if (!name || !store || typeof r.price !== "number") return null;
        return {
          storeName: store,
          postalCode: r.postal_code?.trim() || null,
          productName: name,
          brand: r.brand?.trim() || null,
          price: r.price,
          discount: r.discount?.trim() || null,
          validTo: r.valid_to,
        };
      })
      .filter((d): d is GroceryDeal => d !== null);
  } catch (err) {
    safeLog("error", "grocery_deals.fetch_failed", { errorClass: errorClass(err) });
    return null;
  }
}
