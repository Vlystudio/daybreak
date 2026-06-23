"use client";

import { useState, useTransition } from "react";
import { Egg, Check, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BirdSprite } from "@/components/game/bird-sprite";
import { SPECIES_BY_KEY, RARITY_META, birdLevel, BIRD_SPECIES, type BirdSpecies } from "@/lib/game/birds";
import { hatchEgg, setActiveBird, renameBird } from "@/actions/game";

interface OwnedBird {
  id: string;
  species_key: string;
  nickname: string | null;
  xp: number;
  level: number;
}

export function AviaryPanel({
  seeds,
  eggCost,
  birds,
  activeBirdId,
}: {
  seeds: number;
  eggCost: number;
  birds: OwnedBird[];
  activeBirdId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<{ species: BirdSpecies } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const canHatch = seeds >= eggCost;
  const speciesCollected = new Set(birds.map((b) => b.species_key)).size;

  function hatch() {
    startTransition(async () => {
      const result = await hatchEgg();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const species = SPECIES_BY_KEY[result.speciesKey];
      if (species) setReveal({ species });
    });
  }

  function activate(id: string) {
    startTransition(async () => {
      const r = await setActiveBird(id);
      if (r.ok) toast.success("New buddy on the nest!");
      else toast.error(r.error);
    });
  }

  function saveName(id: string) {
    const name = nameDraft.trim();
    startTransition(async () => {
      const r = await renameBird(id, name);
      if (r.ok) setRenaming(null);
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Your aviary</CardTitle>
        <span className="text-xs text-muted-foreground">
          {speciesCollected}/{BIRD_SPECIES.length} species
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-honey-soft/60 p-3">
          <div>
            <p className="text-sm font-medium text-[#5a3d1a]">Hatch an egg</p>
            <p className="text-xs text-[#9a6b1f]">A surprise bird for {eggCost} 🌱</p>
          </div>
          <Button onClick={hatch} disabled={pending || !canHatch}>
            <Egg aria-hidden />
            {canHatch ? "Hatch" : `Need ${eggCost - seeds} more`}
          </Button>
        </div>

        {birds.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No birds yet — hatch your first one!</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {birds.map((b) => {
              const species = SPECIES_BY_KEY[b.species_key];
              if (!species) return null;
              const active = b.id === activeBirdId;
              return (
                <div
                  key={b.id}
                  className={cn(
                    "relative flex flex-col items-center rounded-2xl border p-2 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  <button type="button" onClick={() => activate(b.id)} disabled={pending} className="flex flex-col items-center" aria-label={`Set ${b.nickname || species.name} active`}>
                    <BirdSprite species={species} size={64} animated={false} />
                    {renaming === b.id ? null : (
                      <span className="mt-0.5 max-w-full truncate text-xs font-medium">{b.nickname || species.name}</span>
                    )}
                  </button>
                  {renaming === b.id ? (
                    <div className="mt-1 flex w-full items-center gap-1">
                      <Input value={nameDraft} maxLength={40} autoFocus onChange={(e) => setNameDraft(e.target.value)} className="h-6 px-1 text-xs" />
                      <button type="button" onClick={() => saveName(b.id)} aria-label="Save name"><Check className="h-3.5 w-3.5 text-sage" aria-hidden /></button>
                    </div>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: RARITY_META[species.rarity].color }} title={RARITY_META[species.rarity].label} />
                      <span className="text-[10px] text-muted-foreground">Lv {birdLevel(b.xp)}</span>
                      <button type="button" onClick={() => { setRenaming(b.id); setNameDraft(b.nickname || ""); }} aria-label="Rename"><Pencil className="h-3 w-3 text-muted-foreground" aria-hidden /></button>
                    </div>
                  )}
                  {active && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">active</span>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReveal(null)}>
          <div className="relative w-full max-w-xs rounded-3xl bg-card p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setReveal(null)} className="absolute right-3 top-3 text-muted-foreground" aria-label="Close"><X className="h-4 w-4" aria-hidden /></button>
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: RARITY_META[reveal.species.rarity].color }}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {RARITY_META[reveal.species.rarity].label}
            </p>
            <div className="my-2 flex justify-center">
              <BirdSprite species={reveal.species} size={150} />
            </div>
            <p className="text-lg font-semibold">{reveal.species.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reveal.species.blurb}</p>
            <Button className="mt-4 w-full" onClick={() => setReveal(null)}>Welcome to the flock!</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
