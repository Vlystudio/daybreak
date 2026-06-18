import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePrice, type PriceSourceKey } from "@/lib/grocery";

/**
 * Provider architecture for grocery pricing.
 *
 * Each store is served by a StorePriceProvider. The provider abstracts WHERE a
 * price comes from. We intentionally ship only COMPLIANT providers:
 *   - DbPriceProvider: serves prices already recorded in product_prices
 *     (however they were compliantly obtained — affiliate API import,
 *     user-permitted import, manual, parsed receipt/flyer, cached history).
 *
 * We deliberately DO NOT implement scrapers that extract pricing from retailer
 * websites — that violates those sites' Terms of Service and is blocked by
 * anti-bot systems. To add automatic live pricing, implement a provider backed
 * by a *licensed/affiliate* grocery price API (or a store loyalty API used with
 * the user's own account + consent) against this same interface.
 */

export type PriceConfidence = "high" | "medium" | "low";

export interface ProviderPrice {
  productName: string;
  brand: string | null;
  size: string | null;
  unit: string | null;
  price: number | null;
  salePrice: number | null;
  promotion: string | null;
  available: boolean;
  sourceKey: PriceSourceKey;
  isEstimated: boolean;
  confidence: PriceConfidence;
  sourceUrl: string | null;
  collectedAt: string;
}

export interface StoreLocationResult {
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface StorePriceProvider {
  storeSlug: string;
  sourceKey: PriceSourceKey;
  searchProducts(query: string): Promise<ProviderPrice[]>;
  getProduct(productId: string): Promise<ProviderPrice | null>;
  getPricing(productName: string): Promise<ProviderPrice | null>;
  getStoreLocation(zip: string): Promise<StoreLocationResult | null>;
  getWeeklyPromotions(): Promise<ProviderPrice[]>;
  getAvailability(productName: string): Promise<boolean>;
}

/** Confidence from how recently a price was collected. */
export function confidenceFor(collectedAt: string, isEstimated: boolean): PriceConfidence {
  if (isEstimated) return "low";
  const ageMs = Date.now() - new Date(collectedAt).getTime();
  const day = 86_400_000;
  if (ageMs <= day) return "high";
  if (ageMs <= 7 * day) return "medium";
  return "low";
}

interface PriceRow {
  price: number | null;
  sale_price: number | null;
  unit: string | null;
  package_size: string | null;
  sale_expires: string | null;
  source_key: PriceSourceKey | null;
  is_estimated: boolean;
  recorded_at: string;
  products: { name: string; brand: string | null; size_unit: string | null } | null;
}

function toProviderPrice(r: PriceRow): ProviderPrice {
  const isEstimated = r.is_estimated;
  return {
    productName: r.products?.name ?? "Unknown",
    brand: r.products?.brand ?? null,
    size: r.package_size,
    unit: r.unit ?? r.products?.size_unit ?? null,
    price: r.price,
    salePrice: r.sale_price,
    promotion: r.sale_expires ? `Sale through ${r.sale_expires}` : null,
    available: true,
    sourceKey: r.source_key ?? "manual",
    isEstimated,
    confidence: confidenceFor(r.recorded_at, isEstimated),
    sourceUrl: null,
    collectedAt: r.recorded_at,
  };
}

/** Serves whatever compliant prices exist in the DB for a given store. */
export class DbPriceProvider implements StorePriceProvider {
  readonly sourceKey: PriceSourceKey = "cached_historical";
  constructor(public readonly storeSlug: string, private readonly storeId: string) {}

  private async query(matchName?: string): Promise<ProviderPrice[]> {
    const admin = createAdminClient();
    let q = admin
      .from("product_prices")
      .select("price, sale_price, unit, package_size, sale_expires, source_key, is_estimated, recorded_at, products(name, brand, size_unit)")
      .eq("store_id", this.storeId)
      .order("recorded_at", { ascending: false })
      .limit(50);
    if (matchName) q = q.ilike("products.name", `%${matchName}%`);
    const { data } = await q.returns<PriceRow[]>();
    return (data ?? []).filter((r) => r.products).map(toProviderPrice);
  }

  searchProducts(query: string) {
    return this.query(query);
  }
  async getProduct(productId: string): Promise<ProviderPrice | null> {
    const admin = createAdminClient();
    const { data } = await admin
      .from("product_prices")
      .select("price, sale_price, unit, package_size, sale_expires, source_key, is_estimated, recorded_at, products(name, brand, size_unit)")
      .eq("store_id", this.storeId)
      .eq("product_id", productId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle<PriceRow>();
    return data && data.products ? toProviderPrice(data) : null;
  }
  async getPricing(productName: string): Promise<ProviderPrice | null> {
    const results = await this.query(productName);
    // Cheapest current option for that name.
    const eff = (p: ProviderPrice) => effectivePrice({ price: p.price, sale_price: p.salePrice });
    return results.sort((a, b) => (eff(a) ?? Infinity) - (eff(b) ?? Infinity))[0] ?? null;
  }
  async getStoreLocation(): Promise<StoreLocationResult | null> {
    return null; // location resolution would come from a compliant geocoding/store-locator source
  }
  async getWeeklyPromotions(): Promise<ProviderPrice[]> {
    const all = await this.query();
    return all.filter((p) => p.salePrice != null);
  }
  async getAvailability(): Promise<boolean> {
    return true;
  }
}

/** Build the provider for a store. Swap in an API-backed provider here when available. */
export function getProvider(storeSlug: string, storeId: string): StorePriceProvider {
  return new DbPriceProvider(storeSlug, storeId);
}
