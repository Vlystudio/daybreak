// One-off: seed prod product_prices from the grocerytracker deals feed.
// Mirrors src/lib/grocery/import-deals.ts. Side-effect-free (no emails/push) —
// just reads the deals feed and writes the shared price catalog. The deployed
// cron + "Refresh deals" button use the real importGroceryDeals going forward.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const EXTERNAL_SOURCE = "grocerytracker";
const slugify = (s) =>
  s.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// 1. Fetch active, priced deals.
const params = new URLSearchParams({
  select: "product_name,brand,store,merchant_raw,price,discount,valid_to,postal_code",
  valid_to: `gte.${new Date().toISOString()}`,
  price: "not.is.null",
  order: "retrieved_at.desc",
  limit: "5000",
});
const res = await fetch(`${env.GROCERYTRACKER_URL.replace(/\/$/, "")}/rest/v1/grocery_deals?${params}`, {
  headers: { apikey: env.GROCERYTRACKER_ANON_KEY, Authorization: `Bearer ${env.GROCERYTRACKER_ANON_KEY}` },
});
if (!res.ok) throw new Error(`feed ${res.status}`);
const deals = (await res.json())
  .map((r) => {
    const name = r.product_name?.trim();
    const store = (r.store || r.merchant_raw || "").trim();
    if (!name || !store || typeof r.price !== "number") return null;
    return { storeName: store, postalCode: r.postal_code?.trim() || null, productName: name, brand: r.brand?.trim() || null, price: r.price, validTo: r.valid_to };
  })
  .filter(Boolean);
console.log(`fetched ${deals.length} active priced deals`);

// 2. Stores (reuse by slug, create new merchants).
const { data: existingStores } = await admin.from("stores").select("id, slug");
const storeIdBySlug = new Map((existingStores ?? []).map((s) => [s.slug, s.id]));
const newStores = [...new Set(deals.map((d) => d.storeName))]
  .filter((n) => !storeIdBySlug.has(slugify(n)))
  .map((n) => ({ slug: slugify(n), name: n, default_pricing_source: "web" }));
if (newStores.length) {
  const { data: created, error } = await admin.from("stores").insert(newStores).select("id, slug");
  if (error) throw error;
  for (const s of created) storeIdBySlug.set(s.slug, s.id);
  console.log(`created stores: ${newStores.map((s) => s.name).join(", ")}`);
}
const storeIdFor = (name) => storeIdBySlug.get(slugify(name)) ?? null;

// 3. Store locations per (store, postal).
const locKey = (sid, p) => `${sid}|${p}`;
const { data: existingLocs } = await admin.from("store_locations").select("id, store_id, postal_code");
const locIdByKey = new Map((existingLocs ?? []).filter((l) => l.postal_code).map((l) => [locKey(l.store_id, l.postal_code), l.id]));
const neededLocs = new Map();
for (const d of deals) {
  const sid = storeIdFor(d.storeName);
  if (!sid || !d.postalCode) continue;
  const k = locKey(sid, d.postalCode);
  if (!locIdByKey.has(k)) neededLocs.set(k, { store_id: sid, postal_code: d.postalCode, label: d.postalCode });
}
if (neededLocs.size) {
  const { data: createdLocs, error } = await admin.from("store_locations").insert([...neededLocs.values()]).select("id, store_id, postal_code");
  if (error) throw error;
  for (const l of createdLocs) if (l.postal_code) locIdByKey.set(locKey(l.store_id, l.postal_code), l.id);
  console.log(`created ${createdLocs.length} store locations`);
}

// 4. Wipe previous import (cascades to its prices).
const { error: delErr } = await admin.from("products").delete().eq("external_source", EXTERNAL_SOURCE);
if (delErr) throw delErr;

// 5. Build + insert products and prices.
const productRows = [];
const priceRows = [];
for (const d of deals) {
  const sid = storeIdFor(d.storeName);
  if (!sid) continue;
  const id = randomUUID();
  productRows.push({ id, name: d.productName.slice(0, 200), brand: d.brand?.slice(0, 120) ?? null, external_source: EXTERNAL_SOURCE });
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
const chunk = async (table, rows) => {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
};
await chunk("products", productRows);
await chunk("product_prices", priceRows);
console.log(`DONE: stores=${storeIdBySlug.size} products=${productRows.length} prices=${priceRows.length}`);
