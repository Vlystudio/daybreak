"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO, isBefore } from "date-fns";
import { Plus, X, Refrigerator, Snowflake, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPantryItem, removePantryItem } from "@/actions/grocery";
import { STORAGE_LOCATIONS, type PantryItem, type StorageLocation } from "@/lib/grocery";

const LOCATION_META: Record<StorageLocation, { label: string; icon: typeof Package }> = {
  pantry: { label: "Pantry", icon: Package },
  fridge: { label: "Fridge", icon: Refrigerator },
  freezer: { label: "Freezer", icon: Snowflake },
};

export function PantryView({ items: initial }: { items: PantryItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<PantryItem[]>(initial);
  // Re-sync when the server sends a fresh list (after add/remove + router.refresh()).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState<StorageLocation>("pantry");
  const [expiration, setExpiration] = useState("");

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addPantryItem({
        name: name.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        unit: unit.trim() || undefined,
        location,
        expirationDate: expiration || undefined,
      });
      if (res.ok) {
        setName("");
        setQuantity("");
        setUnit("");
        setExpiration("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const res = await removePantryItem(id);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add an item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="e.g. chicken breast"
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
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="w-24" maxLength={20} />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as StorageLocation)}
              className="rounded-xl border border-input bg-card px-3 text-sm"
            >
              {STORAGE_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {LOCATION_META[l].label}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="w-40"
              title="Expiration (optional)"
            />
          </div>
          <Button onClick={add} disabled={pending} className="mt-3">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {STORAGE_LOCATIONS.map((loc) => {
          const Meta = LOCATION_META[loc];
          const Icon = Meta.icon;
          const locItems = items.filter((i) => i.location === loc);
          return (
            <Card key={loc}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" aria-hidden /> {Meta.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Empty.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {locItems.map((item) => {
                      const expiringSoon =
                        item.expiration_date != null &&
                        isBefore(parseISO(item.expiration_date), new Date(Date.now() + 3 * 86_400_000));
                      return (
                        <li key={item.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-medium">{item.name}</span>
                            {(item.quantity != null || item.unit) && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {item.quantity ?? ""} {item.unit ?? ""}
                              </span>
                            )}
                            {item.expiration_date && (
                              <span className={expiringSoon ? "block text-xs text-destructive" : "block text-xs text-muted-foreground"}>
                                exp {format(parseISO(item.expiration_date), "MMM d")}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
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
        })}
      </div>
    </div>
  );
}
