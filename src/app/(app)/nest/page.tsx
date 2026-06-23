import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadGame } from "@/lib/game/rewards";
import { SEED_COST_EGG } from "@/lib/game/rewards";
import { resolveSpecies } from "@/lib/game/birds";
import { NestStage } from "@/components/game/nest-stage";
import { AviaryPanel } from "@/components/game/aviary-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Nest · Daybreak" };
export const dynamic = "force-dynamic";

export default async function NestPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle<{ timezone: string }>();

  const game = await loadGame(user.id, profile?.timezone ?? "UTC");
  const activeBird = game.birds.find((b) => b.id === game.activeBirdId) ?? null;
  const activeSpecies = activeBird ? resolveSpecies(activeBird) : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nest</h1>
          <p className="mt-1 text-sm text-muted-foreground">Care for yourself, grow your flock.</p>
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

      <AviaryPanel seeds={game.seeds} eggCost={SEED_COST_EGG} birds={game.birds} activeBirdId={game.activeBirdId} />
    </div>
  );
}
