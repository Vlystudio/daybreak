"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { refreshGroceryDeals } from "@/actions/grocery";

export function DealsCard({
  available,
  count,
  lastUpdated,
}: {
  available: boolean;
  count: number;
  lastUpdated: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!available) return null;

  function refresh() {
    startTransition(async () => {
      const result = await refreshGroceryDeals();
      if (result.ok) {
        toast.success(`Imported ${result.prices.toLocaleString()} deal prices.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border-none bg-sage-soft/50">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-sage" aria-hidden />
          Store deals
        </CardTitle>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={pending}>
          <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
          {pending ? "Importing…" : "Refresh deals"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {count > 0 ? (
            <>
              <span className="font-medium text-foreground">{count.toLocaleString()}</span> active deal prices from
              your local flyers feed
              {lastUpdated ? `, updated ${formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}` : ""}.
              These flow into your shopping-list price comparisons automatically.
            </>
          ) : (
            <>No deal prices imported yet. Tap “Refresh deals” to pull this week’s local discounts.</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
