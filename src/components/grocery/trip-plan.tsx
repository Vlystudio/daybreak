import { Sparkles, Store as StoreIcon, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CheapestAllocation, SingleStoreResult, TripRecommendation } from "@/lib/grocery/optimizer";

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function TripPlan({
  recommendation,
  allocation,
  single,
  pricedCount,
  neededCount,
}: {
  recommendation: TripRecommendation | null;
  allocation: CheapestAllocation;
  single: SingleStoreResult | null;
  pricedCount: number;
  neededCount: number;
}) {
  if (neededCount === 0) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          Add items below, then Daybreak will compare your stores to find the cheapest trip.
        </CardContent>
      </Card>
    );
  }

  if (pricedCount === 0 || !recommendation) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          No prices yet for these items at your stores.{" "}
          <a href="/grocery/prices" className="font-medium text-primary underline-offset-2 hover:underline">
            Add some prices
          </a>{" "}
          (and pick your stores) to unlock trip optimization.
        </CardContent>
      </Card>
    );
  }

  const recommendMulti = recommendation.recommendation === "multi";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-honey" aria-hidden /> Best way to shop this
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{recommendation.reason}</p>
          <p className="text-sm text-muted-foreground">
            Priced {pricedCount} of {neededCount} item{neededCount === 1 ? "" : "s"}.
            {recommendation.singleTotal != null && (
              <>
                {" "}
                Split across stores: <span className="font-medium text-foreground">{money(recommendation.multiTotal)}</span> ·
                one stop: <span className="font-medium text-foreground">{money(recommendation.singleTotal)}</span>.
              </>
            )}
          </p>
          {allocation.hasEstimates && (
            <Badge variant="secondary" className="mt-1">Some prices are estimates</Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={recommendMulti ? "ring-2 ring-primary/40" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <StoreIcon className="h-4 w-4 text-primary" aria-hidden /> Cheapest split
              </span>
              <span className="tabular-nums">{money(allocation.total)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocation.allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing priced yet.</p>
            ) : (
              allocation.allocations.map((store) => (
                <div key={store.storeId}>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{store.storeName}</span>
                    <span className="tabular-nums">{money(store.subtotal)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {store.items.map((it, i) => (
                      <li key={`${store.storeId}-${i}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {it.quantity > 1 ? `${it.quantity}× ` : ""}
                          {it.name}
                          {it.isEstimated ? " (est.)" : ""}
                        </span>
                        <span className="tabular-nums">{money(it.price * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
            {allocation.unpricedItems.length > 0 && (
              <p className="text-xs text-muted-foreground">
                No price found: {allocation.unpricedItems.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={!recommendMulti ? "ring-2 ring-primary/40" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-sage" aria-hidden /> One-stop option
              </span>
              {single && <span className="tabular-nums">{money(single.total)}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {single ? (
              <>
                <p>
                  Everything available at <span className="font-medium">{single.storeName}</span> — covers{" "}
                  {single.coveredItems} of {single.totalItems}.
                </p>
                {single.missingItems.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Not carried: {single.missingItems.join(", ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No single store has prices for these items.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
