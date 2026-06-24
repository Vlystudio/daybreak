import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadGame } from "@/lib/game/rewards";
import { SEED_COST_EGG } from "@/lib/game/rewards";
import { resolveSpecies } from "@/lib/game/birds";
import { companionMood } from "@/lib/game/mood";
import { NestStage } from "@/components/game/nest-stage";
import { AviaryPanel } from "@/components/game/aviary-panel";
import { ShopPanel } from "@/components/game/shop-panel";
import { StarterEggs } from "@/components/game/starter-eggs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Nest · Daybreak" };
export const dynamic = "force-dynamic";

export default async function NestPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: profile }, { data: metric }, { data: checkin }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle<{ timezone: string }>(),
    supabase.from("health_metrics").select("readiness_score").eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle<{ readiness_score: number | null }>(),
    supabase.from("subjective_checkins").select("mood").eq("user_id", user.id).eq("date", today).maybeSingle<{ mood: number | null }>(),
  ]);

  const game = await loadGame(user.id, profile?.timezone ?? "UTC");
  const activeBird = game.birds.find((b) => b.id === game.activeBirdId) ?? null;
  const activeSpecies = activeBird ? resolveSpecies(activeBird) : null;
  const companion = companionMood(metric?.readiness_score ?? null, checkin?.mood ?? null);

  // First-time players: run the starter-egg ceremony before the full Nest.
  if (!game.starterDone && game.birds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Nest</h1>
        <StarterEggs />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nest</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Care for yourself, grow your flock.{" "}
            <Link href="/nest/gallery" className="font-medium text-primary hover:underline">
              See all 60 →
            </Link>
          </p>
        </div>
        <div className="rounded-full bg-honey-soft px-4 py-2 text-right">
          <p className="text-xl font-semibold tabular-nums text-[#5a3d1a]">{game.seeds} 🌱</p>
          <p className="text-[11px] text-[#9a6b1f]">seeds</p>
        </div>
      </div>

      <NestStage
        species={activeSpecies}
        nickname={activeBird?.nickname ?? null}
        xp={activeBird?.xp ?? 0}
        mood={companion.mood}
        moodLabel={companion.label}
        timezone={profile?.timezone ?? "UTC"}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Today&apos;s seeds</CardTitle>
          <span className="text-sm font-medium text-sage">+{game.earnedToday} earned</span>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {game.earnable.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-3 text-sm">
              <span className={cn("flex items-center gap-2", line.done ? "text-foreground" : "text-muted-foreground")}>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    line.done ? "border-sage bg-sage text-white" : "border-muted-foreground/30"
                  )}
                >
                  {line.done ? <Check className="h-3 w-3" aria-hidden /> : ""}
                </span>
                {line.label}
              </span>
              <span className={cn("tabular-nums", line.done ? "font-medium text-sage" : "text-muted-foreground")}>
                +{line.amount} 🌱
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Seeds land here as you complete your day. Pet your bird for a little extra.
          </p>
        </CardContent>
      </Card>

      <ShopPanel
        seeds={game.seeds}
        inventory={game.inventory}
        activeBird={
          activeBird && activeSpecies
            ? { id: activeBird.id, name: activeBird.nickname || activeSpecies.name, speciesKey: activeSpecies.key, happiness: activeBird.happiness }
            : null
        }
      />

      <AviaryPanel
        seeds={game.seeds}
        eggCost={SEED_COST_EGG}
        birds={game.birds}
        activeBirdId={game.activeBirdId}
        freeHatches={game.freeHatches}
      />
    </div>
  );
}
