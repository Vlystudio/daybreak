import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveDeals } from "@/lib/integrations/grocery-deals";

/**
 * Imports the external grocery-deals feed into the shared price catalog so the
 * shopping-list optimizer can use real discount prices. Idempotent: each run
 * deletes the previous import (products tagged `grocerytracker`, whose
 * product_prices cascade away) and reloads, leaving manual/user prices intact.
 */

const EXTERNAL_SOURCE = "grocerytracker";

export interface ImportResult {
  stores: number;
  products: number;
  prices: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function insertChunked(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  rows: object[],
  size = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    // Dynamic table name → untyped insert; the row shapes are built above.
    const { error } = await admin.from(table).insert(rows.slice(i, i + size) as never);
    if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
  }
}

export async function importGroceryDeals(): Promise<ImportResult | null> {
  const deals = await fetchActiveDeals();
  if (!deals) return null;
  if (deals.length === 0) return { stores: 0, products: 0, prices: 0 };

  const admin = createAdminClient();

  // 1. Stores — reuse by slug, create any new merchants (e.g. Shaw's).
  const { data: existingStores } = await admin
    .from("stores")
    .select("id, slug")
    .returns<{ id: string; slug: string }[]>();
  const storeIdBySlug = new Map((existingStores ?? []).map((s) => [s.slug, s.id]));

  const dealStoreNames = [...new Set(deals.map((d) => d.storeName))];
  const newStores = dealStoreNames
    .filter((n) => !storeIdBySlug.has(slugify(n)))
    .map((n) => ({ slug: slugify(n), name: n, default_pricing_source: "web" }));
  if (newStores.length) {
    const { data: created, error } = await admin
      .from("stores")
      .insert(newStores)
      .select("id, slug")
      .returns<{ id: string; slug: string }[]>();
    if (error) throw new Error(`Failed to create stores: ${error.message}`);
    for (const s of created ?? []) storeIdBySlug.set(s.slug, s.id);
  }
  const storeIdFor = (name: string) => storeIdBySlug.get(slugify(name)) ?? null;

  // 2. Store locations — one per (store, postal_code); reuse existing.
  const locKey = (storeId: string, postal: string) => `${storeId}|${postal}`;
  const { data: existingLocs } = await admin
    .from("store_locations")
    .select("id, store_id, postal_code")
    .returns<{ id: string; store_id: string; postal_code: string | null }[]>();
  const locIdByKey = new Map(
    (existingLocs ?? []).filter((l) => l.postal_code).map((l) => [locKey(l.store_id, l.postal_code!), l.id])
  );

  const neededLocs = new Map<string, { store_id: string; postal_code: string; label: string }>();
  for (const d of deals) {
    const sid = storeIdFor(d.storeName);
    if (!sid || !d.postalCode) continue;
    const k = locKey(sid, d.postalCode);
    if (!locIdByKey.has(k)) neededLocs.set(k, { store_id: sid, postal_code: d.postalCode, label: d.postalCode });
  }
  if (neededLocs.size) {
    const { data: createdLocs, error } = await admin
      .from("store_locations")
      .insert([...neededLocs.values()])
      .select("id, store_id, postal_code")
      .returns<{ id: string; store_id: string; postal_code: string | null }[]>();
    if (error) throw new Error(`Failed to create store locations: ${error.message}`);
    for (const l of createdLocs ?? []) if (l.postal_code) locIdByKey.set(locKey(l.store_id, l.postal_code), l.id);
  }

  // 3. Wipe the previous import (cascades to its product_prices).
  const { error: delErr } = await admin.from("products").delete().eq("external_source", EXTERNAL_SOURCE);
  if (delErr) throw new Error(`Failed to clear previous import: ${delErr.message}`);

  // 4. Build fresh products + prices with client-generated ids for linkage.
  const productRows: { id: string; name: string; brand: string | null; external_source: string }[] = [];
  const priceRows: {
    product_id: string;
    store_id: string;
    store_location_id: string | null;
    price: number;
    sale_expires: string | null;
    source_key: string;
    is_estimated: boolean;
  }[] = [];

  for (const d of deals) {
    const sid = storeIdFor(d.storeName);
    if (!sid) continue;
    const id = randomUUID();
    productRows.push({
      id,
      name: d.productName.slice(0, 200),
      brand: d.brand?.slice(0, 120) ?? null,
      external_source: EXTERNAL_SOURCE,
    });
    priceRows.push({
      product_id: id,
      store_id: sid,
      store_location_id: d.postalCode ? locIdByKey.get(locKey(sid, d.postalCode)) ?? null : null,
      price: d.price,
      sale_expires: d.validTo ? d.validTo.slice(0, 10) : null,
      source_key: "web",
      is_estimated: false,
    });
  }

  await insertChunked(admin, "products", productRows);
  await insertChunked(admin, "product_prices", priceRows);

  return { stores: dealStoreNames.length, products: productRows.length, prices: priceRows.length };
}
