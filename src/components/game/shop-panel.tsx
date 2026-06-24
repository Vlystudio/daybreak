"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { birdAsset } from "@/data/birds";
import { FOOD_ITEMS, DIET_META, canEat, dietOf, type FoodItem } from "@/lib/game/shop";
import { buyFood, feedBird } from "@/actions/shop";

interface ActiveBird {
  id: string;
  name: string;
  speciesKey: string;
  happiness: number;
}

export function ShopPanel({
  seeds,
  inventory,
  activeBird,
}: {
  seeds: number;
  inventory: Record<string, number>;
  activeBird: ActiveBird | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"feed" | "shop">("feed");
  const [pending, startTransition] = useTransition();
  const [happiness, setHappiness] = useState(activeBird?.happiness ?? 60);

  const diet = dietOf(activeBird?.speciesKey);
  const asset = activeBird ? birdAsset(activeBird.speciesKey) : null;
  const ownedFoods = FOOD_ITEMS.filter((f) => (inventory[f.key] ?? 0) > 0);

  function buy(food: FoodItem, qty: number) {
    startTransition(async () => {
      const r = await buyFood(food.key, qty);
      if (r.ok) {
        toast.success(`Bought ${qty}× ${food.name} ${food.emoji}`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function feed(food: FoodItem) {
    if (!activeBird) return;
    startTransition(async () => {
      const r = await feedBird(activeBird.id, food.key);
      if (r.ok) {
        setHappiness(r.happiness);
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Shop &amp; pantry</CardTitle>
        <span className="rounded-full bg-honey-soft px-3 py-1 text-sm font-semibold text-[#5a3d1a]">{seeds} 🌱</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 rounded-full bg-muted p-1 text-sm">
          {(["feed", "shop"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("flex-1 rounded-full py-1.5 font-medium capitalize transition-colors", tab === t ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {t === "feed" ? "Feed" : "Shop"}
            </button>
          ))}
        </div>

        {tab === "feed" ? (
          !activeBird ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Hatch a bird first, then feed it here.</p>
          ) : (
            <div className="space-y-4">
              {/* active bird + happiness + diet */}
              <div className="flex items-center gap-3 rounded-2xl bg-sage-soft/40 p-3">
                {asset && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset} alt={activeBird.name} className="h-14 w-14 shrink-0 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activeBird.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full rounded-full transition-all" style={{ width: `${happiness}%`, background: "#f2748c" }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#e0556e" }}>{happiness}% ❤</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Eats {diet.map((t) => DIET_META[t].emoji).join(" ")}{" "}
                    <span className="opacity-70">({diet.map((t) => DIET_META[t].label.toLowerCase()).join(", ")})</span>
                  </p>
                </div>
              </div>

              {ownedFoods.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Your pantry is empty.{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTab("shop")}>
                    Visit the shop →
                  </button>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ownedFoods.map((food) => {
                    const ok = canEat(activeBird.speciesKey, food.key);
                    return (
                      <div key={food.key} className={cn("flex flex-col items-center rounded-2xl border p-2 text-center", ok ? "border-border" : "border-dashed border-border/60 opacity-60")}>
                        <span className="text-2xl">{food.emoji}</span>
                        <span className="text-xs font-medium leading-tight">{food.name}</span>
                        <span className="text-[10px] text-muted-foreground">×{inventory[food.key]}</span>
                        {ok ? (
                          <Button size="sm" className="mt-1 h-7 w-full text-xs" disabled={pending} onClick={() => feed(food)}>
                            Feed
                          </Button>
                        ) : (
                          <span className="mt-1 text-[9px] leading-tight text-muted-foreground">won&apos;t eat this</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FOOD_ITEMS.map((food) => {
              const owned = inventory[food.key] ?? 0;
              const eats = activeBird ? canEat(activeBird.speciesKey, food.key) : false;
              return (
                <div key={food.key} className="flex items-center gap-3 rounded-2xl border border-border p-2.5">
                  <span className="text-2xl">{food.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {food.name}
                      {eats && <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[9px] font-semibold text-sage">eats this</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{food.blurb}</p>
                    <p className="text-[11px] text-muted-foreground">{food.cost} 🌱 · owned {owned}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={pending || seeds < food.cost} onClick={() => buy(food, 1)}>
                      Buy
                    </Button>
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" disabled={pending || seeds < food.cost * 5} onClick={() => buy(food, 5)}>
                      ×5
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
