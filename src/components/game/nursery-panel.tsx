"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mateBirds, hatchBredEgg } from "@/actions/breeding";
import { MAX_EGGS } from "@/lib/game/shop";

interface BirdOpt {
  id: string;
  name: string;
}
interface Egg {
  id: string;
  rarity: string;
  hatchAt: string;
}

const RARITY_COLOR: Record<string, string> = { common: "#8a9099", uncommon: "#3f9d5a", rare: "#3b7fd2", legendary: "#b5862f" };

function countdown(ms: number): string {
  if (ms <= 0) return "ready!";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NurseryPanel({ birds, eggs }: { birds: BirdOpt[]; eggs: Egg[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [a, setA] = useState(birds[0]?.id ?? "");
  const [b, setB] = useState(birds[1]?.id ?? "");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function pair() {
    startTransition(async () => {
      const r = await mateBirds(a, b);
      if (r.ok) {
        toast.success("They paired up! An egg is on the way 🥚");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function hatch(id: string) {
    startTransition(async () => {
      const r = await hatchBredEgg(id);
      if (r.ok) {
        toast.success(`Your egg hatched into a ${r.speciesName}! 🐣`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  if (birds.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nursery</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-2 text-sm text-muted-foreground">Collect at least two birds to start pairing them up.</p>
        </CardContent>
      </Card>
    );
  }

  const full = eggs.length >= MAX_EGGS;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Nursery</CardTitle>
        <span className="text-xs text-muted-foreground">{eggs.length}/{MAX_EGGS} eggs</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Pair two birds and they&apos;ll lay an egg. Luck decides the chick — usually one of the parents, sometimes a rare surprise.</p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">First bird</span>
            <select value={a} onChange={(e) => setA(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-2 text-sm">
              {birds.map((bd) => (
                <option key={bd.id} value={bd.id}>{bd.name}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">Second bird</span>
            <select value={b} onChange={(e) => setB(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-2 text-sm">
              {birds.map((bd) => (
                <option key={bd.id} value={bd.id}>{bd.name}</option>
              ))}
            </select>
          </label>
          <Button className="shrink-0" disabled={pending || full || a === b} onClick={pair}>
            <HeartHandshake aria-hidden /> Pair up
          </Button>
        </div>
        {full && <p className="text-xs text-amber-600">Nursery full — hatch an egg to free up space.</p>}
        {a === b && <p className="text-xs text-muted-foreground">Pick two different birds.</p>}

        {eggs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {eggs.map((egg) => {
              const remaining = new Date(egg.hatchAt).getTime() - now;
              const ready = remaining <= 0;
              return (
                <div key={egg.id} className="flex flex-col items-center rounded-2xl border p-2 text-center" style={{ borderColor: RARITY_COLOR[egg.rarity] ?? "#8a9099" }}>
                  <span className={ready ? "bird-bob text-3xl" : "text-3xl"}>🥚</span>
                  {ready ? (
                    <Button size="sm" className="mt-1 h-7 w-full text-xs" disabled={pending} onClick={() => hatch(egg.id)}>
                      Hatch
                    </Button>
                  ) : (
                    <span className="mt-1 text-[11px] font-medium tabular-nums text-muted-foreground">{countdown(remaining)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
