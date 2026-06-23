"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BirdSprite } from "@/components/game/bird-sprite";
import { SPECIES_BY_KEY, RARITY_META, type BirdSpecies } from "@/lib/game/birds";
import { claimStarter } from "@/actions/game";

const EGGS = [
  { from: "#fbe2b0", to: "#f0b96a", spot: "#d99a45" },
  { from: "#cfe4f6", to: "#8fbfe8", spot: "#5f96c4" },
  { from: "#d8ecd2", to: "#a6d29a", spot: "#6fa860" },
  { from: "#f7d6e2", to: "#f0a8c2", spot: "#d97a9c" },
];

function Egg({ palette, className }: { palette: (typeof EGGS)[number]; className?: string }) {
  return (
    <span
      className={cn("relative block h-24 w-[4.5rem]", className)}
      style={{
        borderRadius: "50% 50% 50% 50% / 60% 60% 42% 42%",
        background: `radial-gradient(circle at 35% 30%, ${palette.from}, ${palette.to})`,
        boxShadow: "inset -4px -6px 10px rgba(0,0,0,0.12)",
      }}
      aria-hidden
    >
      <span className="absolute left-3 top-9 h-2 w-2 rounded-full" style={{ background: palette.spot, opacity: 0.5 }} />
      <span className="absolute right-3 top-12 h-1.5 w-1.5 rounded-full" style={{ background: palette.spot, opacity: 0.5 }} />
      <span className="absolute left-6 top-16 h-1.5 w-1.5 rounded-full" style={{ background: palette.spot, opacity: 0.5 }} />
    </span>
  );
}

export function StarterEggs() {
  const router = useRouter();
  const [phase, setPhase] = useState<"choose" | "hatch" | "reveal">("choose");
  const [kept, setKept] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<BirdSpecies | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(i: number) {
    setKept((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < 2 ? [...cur, i] : cur));
  }

  function hatch() {
    startTransition(async () => {
      const result = await claimStarter();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRevealed(SPECIES_BY_KEY[result.speciesKey] ?? null);
      setPhase("reveal");
    });
  }

  return (
    <Card className="border-none bg-sunrise text-[#5a3d1a]">
      <CardContent className="space-y-5 py-8 text-center">
        {phase === "choose" && (
          <>
            <div>
              <h2 className="text-xl font-semibold">Welcome to your Nest 🥚</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm opacity-80">
                Four eggs have appeared. Choose <strong>two</strong> to keep — you’ll hatch one now and save the other.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {EGGS.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={kept.includes(i)}
                  className={cn(
                    "rounded-3xl p-2 transition-all",
                    kept.includes(i) ? "scale-105 bg-white/60 ring-2 ring-[#9a6b1f]" : "hover:scale-105 hover:bg-white/30"
                  )}
                >
                  <Egg palette={e} className={kept.includes(i) ? "bird-bob" : undefined} />
                </button>
              ))}
            </div>
            <Button disabled={kept.length !== 2} onClick={() => setPhase("hatch")} className="mx-auto">
              {kept.length === 2 ? "Keep these two →" : `Pick ${2 - kept.length} more`}
            </Button>
          </>
        )}

        {phase === "hatch" && (
          <>
            <div>
              <h2 className="text-xl font-semibold">Which one hatches first?</h2>
              <p className="mt-1 text-sm opacity-80">Tap an egg to hatch it. The other is yours to hatch free, anytime.</p>
            </div>
            <div className="flex items-center justify-center gap-6">
              {kept.map((idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={pending}
                  onClick={hatch}
                  className="rounded-3xl p-2 transition-transform hover:scale-110 disabled:opacity-60"
                  aria-label="Hatch this egg"
                >
                  <Egg palette={EGGS[idx]} className="bird-bob" />
                </button>
              ))}
            </div>
            {pending && <p className="text-sm font-medium">Hatching…</p>}
          </>
        )}

        {phase === "reveal" && revealed && (
          <>
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: RARITY_META[revealed.rarity].color }}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {RARITY_META[revealed.rarity].label}
            </p>
            <div className="flex justify-center">
              <BirdSprite species={revealed} size={150} mood="happy" />
            </div>
            <div>
              <p className="text-xl font-semibold">Meet your {revealed.name}!</p>
              <p className="mt-1 text-sm opacity-80">{revealed.blurb}</p>
              <p className="mt-2 text-sm font-medium">🥚 Your second egg is saved — hatch it free whenever you like.</p>
            </div>
            <Button onClick={() => router.refresh()} className="mx-auto">
              Enter your Nest
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
