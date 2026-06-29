"use client";

import { useState, useTransition } from "react";
import { Egg, Pencil, Loader2, Check, Crown, Coins } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BirdSprite } from "@/components/game/bird-sprite";
import {
  SPECIES_BY_KEY,
  RARITY_META,
  BIRD_SPECIES,
  resolveSpecies,
  archetypeFor,
  sellValueFor,
  type Rarity,
  type BirdSpecies,
  type OwnedBirdBase,
} from "@/lib/game/birds";
import { playBirdCall } from "@/lib/game/bird-sounds";
import { hatchEgg, setActiveBird, renameBird, sellBird } from "@/actions/game";

interface OwnedBird extends OwnedBirdBase {
  id: string;
  nickname: string | null;
  xp: number;
  level: number;
  accessory?: string | null;
}

interface SpeciesGroup {
  key: string;
  species: BirdSpecies;
  individuals: OwnedBird[];
  bestLevel: number;
  hasActive: boolean;
}

/**
 * Stack duplicate birds into one card per species (e.g. "Cedar Waxwing ×3"),
 * while preserving each individual's identity (nickname, level, active state)
 * for the manage sheet. Rarest species surface first; the active companion's
 * species floats to the top.
 */
function groupBirds(birds: OwnedBird[], activeBirdId: string | null): SpeciesGroup[] {
  const map = new Map<string, SpeciesGroup>();
  for (const b of birds) {
    const species = resolveSpecies(b);
    let g = map.get(species.key);
    if (!g) {
      g = { key: species.key, species, individuals: [], bestLevel: 1, hasActive: false };
      map.set(species.key, g);
    }
    g.individuals.push(b);
    g.bestLevel = Math.max(g.bestLevel, b.level);
    if (b.id === activeBirdId) g.hasActive = true;
  }
  for (const g of map.values()) {
    g.individuals.sort(
      (a, z) => Number(z.id === activeBirdId) - Number(a.id === activeBirdId) || z.level - a.level
    );
  }
  return [...map.values()].sort(
    (a, z) =>
      Number(z.hasActive) - Number(a.hasActive) ||
      RARITY_META[a.species.rarity].weight - RARITY_META[z.species.rarity].weight ||
      a.species.name.localeCompare(z.species.name)
  );
}

function RarityTag({ rarity, className }: { rarity: Rarity; className?: string }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[11px] font-medium", className)}
      style={{ color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function AviaryPanel({
  seeds,
  eggCost,
  birds,
  activeBirdId,
  freeHatches = 0,
}: {
  seeds: number;
  eggCost: number;
  birds: OwnedBird[];
  activeBirdId: string | null;
  freeHatches?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<BirdSpecies | null>(null);
  const [manageKey, setManageKey] = useState<string | null>(null);
  // Inline per-bird editing inside the manage sheet — kept in a controlled modal
  // so closing always tears the <input> down (no stuck iOS focus-zoom).
  const [editing, setEditing] = useState<{ id: string; mode: "rename" | "sell" } | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const hasFree = freeHatches > 0;
  const canHatch = hasFree || seeds >= eggCost;
  const hatchPct = Math.min(100, Math.round((seeds / eggCost) * 100));

  const groups = groupBirds(birds, activeBirdId);
  const speciesCollected = new Set(birds.map((b) => resolveSpecies(b).key)).size;
  const activeBird = birds.find((b) => b.id === activeBirdId) ?? null;
  const activeSpecies = activeBird ? resolveSpecies(activeBird) : null;
  const manageGroup = manageKey ? (groups.find((g) => g.key === manageKey) ?? null) : null;

  function closeManage() {
    setManageKey(null);
    setEditing(null);
    setNameDraft("");
  }

  function hatch() {
    startTransition(async () => {
      const result = await hatchEgg();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const species = SPECIES_BY_KEY[result.speciesKey];
      if (species) setReveal(species);
    });
  }

  function activate(b: OwnedBird, species: BirdSpecies) {
    startTransition(async () => {
      playBirdCall(archetypeFor(species));
      const r = await setActiveBird(b.id);
      if (r.ok) toast.success(`${b.nickname || species.name} is your companion now.`);
      else toast.error(r.error ?? "Couldn't set that companion.");
    });
  }

  function openRename(b: OwnedBird) {
    setEditing({ id: b.id, mode: "rename" });
    setNameDraft(b.nickname ?? "");
  }

  function openActiveRename() {
    if (!activeBird || !activeSpecies) return;
    setManageKey(activeSpecies.key);
    openRename(activeBird);
  }

  function saveName(id: string) {
    const name = nameDraft.trim();
    startTransition(async () => {
      const r = await renameBird(id, name);
      if (r.ok) {
        setEditing(null);
        toast.success(name ? "Name saved." : "Name cleared.");
      } else toast.error(r.error ?? "Couldn't rename that bird.");
    });
  }

  function sell(b: OwnedBird, species: BirdSpecies, lastInGroup: boolean) {
    startTransition(async () => {
      const r = await sellBird(b.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Sold ${r.speciesName} for ${r.value} 🌱`);
      setEditing(null);
      if (lastInGroup) closeManage(); // the species card is gone now
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Aviary</CardTitle>
        <span className="text-muted-foreground text-xs tabular-nums">
          {speciesCollected} / {BIRD_SPECIES.length} species
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active companion — featured, named, with a calm crown rather than a badge over the art. */}
        {activeBird && activeSpecies && (
          <div className="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-2xl border p-3">
            <div className="bg-card shadow-soft shrink-0 rounded-xl p-1.5">
              <BirdSprite
                species={activeSpecies}
                size={52}
                animated={false}
                accessoryKey={activeBird.accessory ?? null}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-primary flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
                <Crown className="h-3.5 w-3.5" aria-hidden /> Your companion
              </span>
              <p className="truncate text-base leading-tight font-semibold">
                {activeBird.nickname || activeSpecies.name}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <RarityTag rarity={activeSpecies.rarity} />
                <span className="text-muted-foreground text-[11px]">Lv {activeBird.level}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={openActiveRename} className="shrink-0">
              <Pencil aria-hidden /> Rename
            </Button>
          </div>
        )}

        {/* Hatch — clear progress toward the next egg. */}
        <div className="bg-honey-soft/60 rounded-2xl p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#5a3d1a]">
                {hasFree ? "Hatch a free egg" : "Hatch an egg"}
              </p>
              <p className="text-xs text-[#9a6b1f]">
                {hasFree
                  ? `You have ${freeHatches} free egg${freeHatches === 1 ? "" : "s"} waiting 🥚`
                  : "A surprise bird joins your flock."}
              </p>
            </div>
            <Button onClick={hatch} disabled={pending || !canHatch} className="shrink-0">
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Egg aria-hidden />}
              {hasFree ? "Hatch free" : canHatch ? "Hatch egg" : "Locked"}
            </Button>
          </div>
          {!hasFree && (
            <div className="mt-2.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e7d4ab]">
                <div
                  className="h-full rounded-full bg-[#caa24a] transition-all"
                  style={{ width: `${hatchPct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#9a6b1f]">
                <span className="tabular-nums">
                  {Math.min(seeds, eggCost)} / {eggCost} 🌱
                </span>
                <span>{canHatch ? "Ready to hatch!" : `Need ${eggCost - seeds} more`}</span>
              </div>
            </div>
          )}
        </div>

        {/* Collection — one card per species, duplicates stacked. */}
        {birds.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No birds yet — hatch your first egg above.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setManageKey(g.key)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-colors",
                  g.hasActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-accent/40"
                )}
                aria-label={`Manage ${g.species.name}`}
              >
                {g.hasActive && (
                  <span className="bg-primary/90 text-primary-foreground absolute top-2 left-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
                    <Crown className="h-2.5 w-2.5" aria-hidden /> Active
                  </span>
                )}
                {g.individuals.length > 1 && (
                  <span className="bg-foreground/80 text-background absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums">
                    ×{g.individuals.length}
                  </span>
                )}
                <BirdSprite species={g.species} size={60} animated={false} />
                <span className="mt-0.5 line-clamp-2 text-xs leading-tight font-medium">
                  {g.species.name}
                </span>
                <RarityTag rarity={g.species.rarity} />
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  Lv {g.bestLevel} · {sellValueFor(g.species.rarity)} 🌱
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Manage one species: set active, rename, or sell each individual. */}
      <Dialog
        open={!!manageGroup}
        onOpenChange={(open) => {
          if (!open) closeManage();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          {manageGroup && (
            <>
              <DialogHeader>
                <DialogTitle>{manageGroup.species.name}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <RarityTag rarity={manageGroup.species.rarity} />
                  <span>
                    Owned ×{manageGroup.individuals.length} · sells for{" "}
                    {sellValueFor(manageGroup.species.rarity)} 🌱 each
                  </span>
                </DialogDescription>
              </DialogHeader>

              <p className="text-muted-foreground text-sm">{manageGroup.species.blurb}</p>

              <div className="divide-border divide-y">
                {manageGroup.individuals.map((b) => {
                  const isActive = b.id === activeBirdId;
                  const isEditing = editing?.id === b.id;
                  const canSell = birds.length > 1 && !isActive;
                  return (
                    <div key={b.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted/40 shrink-0 rounded-lg p-1">
                          <BirdSprite
                            species={manageGroup.species}
                            size={36}
                            animated={false}
                            accessoryKey={b.accessory ?? null}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {b.nickname || manageGroup.species.name}
                            {isActive && (
                              <Crown className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                          </p>
                          <p className="text-muted-foreground text-[11px]">Lv {b.level}</p>
                        </div>

                        {!isEditing && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            {!isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={() => activate(b, manageGroup.species)}
                              >
                                Set active
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={pending}
                              aria-label="Rename"
                              onClick={() => openRename(b)}
                            >
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground h-8 w-8"
                              disabled={pending || !canSell}
                              aria-label="Sell"
                              title={
                                isActive
                                  ? "Make another bird your companion first"
                                  : birds.length <= 1
                                    ? "This is your last bird"
                                    : "Sell"
                              }
                              onClick={() => setEditing({ id: b.id, mode: "sell" })}
                            >
                              <Coins aria-hidden />
                            </Button>
                          </div>
                        )}
                      </div>

                      {isEditing && editing?.mode === "rename" && (
                        <div className="flex items-center gap-2">
                          <Input
                            value={nameDraft}
                            maxLength={40}
                            autoFocus
                            placeholder={manageGroup.species.name}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName(b.id);
                              if (e.key === "Escape") setEditing(null);
                            }}
                          />
                          <Button size="sm" disabled={pending} onClick={() => saveName(b.id)}>
                            {pending ? (
                              <Loader2 className="animate-spin" aria-hidden />
                            ) : (
                              <Check aria-hidden />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {isEditing && editing?.mode === "sell" && (
                        <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-xl p-2.5">
                          <p className="text-sm">
                            Sell {b.nickname || manageGroup.species.name} for{" "}
                            <span className="font-semibold">
                              {sellValueFor(manageGroup.species.rarity)} 🌱
                            </span>
                            ?
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pending}
                              onClick={() =>
                                sell(b, manageGroup.species, manageGroup.individuals.length === 1)
                              }
                            >
                              {pending ? (
                                <Loader2 className="animate-spin" aria-hidden />
                              ) : (
                                <Coins aria-hidden />
                              )}
                              Sell
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hatch reveal. */}
      <Dialog
        open={!!reveal}
        onOpenChange={(open) => {
          if (!open) setReveal(null);
        }}
      >
        <DialogContent className="max-w-xs text-center">
          {reveal && (
            <>
              <DialogHeader className="items-center space-y-1">
                <RarityTag rarity={reveal.rarity} className="text-xs tracking-wide uppercase" />
                <DialogTitle className="text-lg">{reveal.name}</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center">
                <BirdSprite species={reveal} size={150} />
              </div>
              <DialogDescription>{reveal.blurb}</DialogDescription>
              <Button className="w-full" onClick={() => setReveal(null)}>
                Welcome to the flock!
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
