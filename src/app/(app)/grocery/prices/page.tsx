import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { integrationsAvailable } from "@/env";
import { PriceEntry } from "@/components/grocery/price-entry";
import { DealsCard } from "@/components/grocery/deals-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { effectivePrice, type Store } from "@/lib/grocery";

export const metadata = { title: "Prices · Daybreak" };

interface RecentPriceRow {
  id: string;
  price: number | null;
  sale_price: number | null;
  unit: string | null;
  package_size: string | null;
  recorded_at: string;
  products: { name: string; brand: string | null } | null;
  stores: { name: string } | null;
}

export default async function PricesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: stores }, { data: recent }, { count: dealCount }, { data: latestDeal }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, slug, name, default_pricing_source, website")
      .order("name")
      .returns<Store[]>(),
    supabase
      .from("product_prices")
      .select("id, price, sale_price, unit, package_size, recorded_at, products(name, brand), stores(name)")
      .eq("recorded_by", user.id)
      .order("recorded_at", { ascending: false })
      .limit(20)
      .returns<RecentPriceRow[]>(),
    supabase.from("product_prices").select("id", { count: "exact", head: true }).eq("source_key", "web"),
    supabase
      .from("product_prices")
      .select("recorded_at")
      .eq("source_key", "web")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ recorded_at: string }>(),
  ]);

  const recentPrices = recent ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href="/grocery"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Grocery
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Prices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The more prices you log, the smarter your shopping trips get.
        </p>
      </div>

      <DealsCard
        available={integrationsAvailable.groceryDeals()}
        count={dealCount ?? 0}
        lastUpdated={latestDeal?.recorded_at ?? null}
      />

      <PriceEntry stores={stores ?? []} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recently added by you</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPrices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prices recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {recentPrices.map((r) => {
                const eff = effectivePrice({ price: r.price, sale_price: r.sale_price });
                const onSale = r.sale_price != null && (r.price == null || r.sale_price < r.price);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <span className="font-medium">{r.products?.name ?? "Unknown"}</span>
                      {r.products?.brand && (
                        <span className="text-muted-foreground"> · {r.products.brand}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {r.stores?.name ?? "Unknown store"}
                        {r.package_size ? ` · ${r.package_size}` : ""}
                        {r.unit ? ` · per ${r.unit}` : ""}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums">
                        {eff != null ? `$${eff.toFixed(2)}` : "—"}
                      </span>
                      {onSale && <span className="block text-xs text-sage">on sale</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
