import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { buildOptimizerItems, type PricedStore } from "@/lib/grocery/pricing";
import { allocateCheapest, bestSingleStore, optimizeTrip } from "@/lib/grocery/optimizer";
import { TripPlan } from "@/components/grocery/trip-plan";
import {
  ShoppingListDetail,
  type ShoppingItem,
  type PriceHint,
} from "@/components/grocery/shopping-list-detail";

export const metadata = { title: "Shopping list · Daybreak" };

interface ListRow {
  id: string;
  title: string | null;
  status: "active" | "completed" | "archived";
  meal_plan_id: string | null;
}

interface ItemRow {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  status: ShoppingItem["status"];
}

interface UserStoreRow {
  store_id: string;
  distance_miles: number | null;
  stores: { name: string } | null;
}

export default async function ShoppingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id, title, status, meal_plan_id")
    .eq("id", id)
    .maybeSingle<ListRow>();
  if (!list) notFound();

  const [{ data: items }, { data: userStores }, { data: settings }] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("id, name, quantity, unit, status")
      .eq("shopping_list_id", id)
      .order("sort")
      .order("name")
      .returns<ItemRow[]>(),
    supabase
      .from("user_stores")
      .select("store_id, distance_miles, stores(name)")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .is("store_location_id", null)
      .returns<UserStoreRow[]>(),
    supabase
      .from("grocery_settings")
      .select("max_stores_per_trip")
      .eq("user_id", user.id)
      .maybeSingle<{ max_stores_per_trip: number }>(),
  ]);

  const allItems = items ?? [];
  const neededItems = allItems.filter((i) => i.status === "needed");

  const stores: PricedStore[] = (userStores ?? [])
    .filter((s) => s.stores)
    .map((s) => ({ id: s.store_id, name: s.stores!.name }));
  const storeDistanceMiles: Record<string, number> = {};
  for (const s of userStores ?? []) {
    if (s.distance_miles != null) storeDistanceMiles[s.store_id] = s.distance_miles;
  }

  // Price the still-needed items across the user's stores.
  const optimizerItems = await buildOptimizerItems(
    neededItems.map((i) => ({ name: i.name, quantity: i.quantity ?? 1 })),
    stores
  );

  const allocation = allocateCheapest(optimizerItems);
  const single = bestSingleStore(optimizerItems);
  const pricedCount = optimizerItems.filter((it) => it.options.length > 0).length;
  const recommendation =
    pricedCount > 0
      ? optimizeTrip({
          items: optimizerItems,
          storeDistanceMiles,
          maxStores: settings?.max_stores_per_trip,
        })
      : null;

  // Per-item cheapest-price hint (aligned with neededItems order).
  const priceHints: Record<string, PriceHint> = {};
  neededItems.forEach((item, idx) => {
    const opts = optimizerItems[idx]?.options ?? [];
    if (opts.length === 0) return;
    const best = opts.reduce((a, b) => (b.price < a.price ? b : a));
    priceHints[item.id] = { price: best.price, storeName: best.storeName };
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href="/grocery/lists"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Shopping lists
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{list.title || "Shopping list"}</h1>
        {stores.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Pick your stores on the{" "}
            <Link href="/grocery" className="font-medium text-primary hover:underline">
              Grocery
            </Link>{" "}
            page to compare prices.
          </p>
        )}
      </div>

      <TripPlan
        recommendation={recommendation}
        allocation={allocation}
        single={single}
        pricedCount={pricedCount}
        neededCount={neededItems.length}
      />

      <ShoppingListDetail listId={list.id} items={allItems} priceHints={priceHints} />
    </div>
  );
}
