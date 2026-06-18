"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addShoppingListItem, removeShoppingListItem, setShoppingItemStatus } from "@/actions/shopping";
import type { ShoppingItemStatus } from "@/lib/grocery";

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  status: ShoppingItemStatus;
}

export interface PriceHint {
  price: number;
  storeName: string;
}

export function ShoppingListDetail({
  listId,
  items: initial,
  priceHints,
}: {
  listId: string;
  items: ShoppingItem[];
  priceHints: Record<string, PriceHint>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState<ShoppingItem[]>(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addShoppingListItem({
        shoppingListId: listId,
        name: name.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        unit: unit.trim() || undefined,
      });
      if (res.ok) {
        setName("");
        setQuantity("");
        setUnit("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function togglePurchased(item: ShoppingItem) {
    const next: ShoppingItemStatus = item.status === "purchased" ? "needed" : "purchased";
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    startTransition(async () => {
      const res = await setShoppingItemStatus(item.id, next);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const res = await removeShoppingListItem(id);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add an item…"
            maxLength={120}
          />
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            className="w-20"
          />
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit"
            className="w-24"
            maxLength={20}
          />
          <Button onClick={add} disabled={pending}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on this list yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => {
              const purchased = item.status === "purchased";
              const hint = priceHints[item.id];
              return (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={purchased}
                    onChange={() => togglePurchased(item)}
                    aria-label={purchased ? `Mark ${item.name} as needed` : `Mark ${item.name} as bought`}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <div className={cn("min-w-0 flex-1", purchased && "text-muted-foreground line-through")}>
                    <span className="font-medium">{item.name}</span>
                    {(item.quantity != null || item.unit) && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {item.quantity ?? ""} {item.unit ?? ""}
                      </span>
                    )}
                    {!purchased && hint && (
                      <span className="block text-xs text-sage">
                        ${hint.price.toFixed(2)} at {hint.storeName}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
