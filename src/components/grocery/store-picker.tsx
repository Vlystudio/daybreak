"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleStore } from "@/actions/grocery";
import type { Store } from "@/lib/grocery";

export function StorePicker({
  stores,
  enabledStoreIds,
}: {
  stores: Store[];
  enabledStoreIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState<Set<string>>(new Set(enabledStoreIds));

  function toggle(storeId: string) {
    // Optimistic flip; revert on failure.
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
    startTransition(async () => {
      const res = await toggleStore(storeId);
      if (!res.ok) {
        toast.error(res.error);
        setEnabled((prev) => {
          const next = new Set(prev);
          if (next.has(storeId)) next.delete(storeId);
          else next.add(storeId);
          return next;
        });
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your stores</CardTitle>
        <CardDescription>
          Pick the stores you shop at — price comparisons only consider these.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {stores.map((store) => {
            const on = enabled.has(store.id);
            const id = `store-${store.id}`;
            return (
              <li key={store.id} className="flex items-center justify-between py-2.5">
                <Label htmlFor={id} className="cursor-pointer font-medium">
                  {store.name}
                </Label>
                <Switch id={id} checked={on} disabled={pending} onCheckedChange={() => toggle(store.id)} />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
