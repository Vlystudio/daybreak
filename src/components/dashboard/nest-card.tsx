import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BirdSprite } from "@/components/game/bird-sprite";
import { resolveSpecies, type OwnedBirdBase } from "@/lib/game/birds";
import type { Mood } from "@/lib/game/mood";

export function NestCard({
  seeds,
  activeBird,
  nickname,
  mood = "content",
  moodLabel,
}: {
  seeds: number;
  activeBird: OwnedBirdBase | null;
  nickname: string | null;
  mood?: Mood;
  moodLabel?: string;
}) {
  const species = activeBird ? resolveSpecies(activeBird) : null;

  return (
    <Card className="h-full bg-gradient-to-br from-[#dff1e3] to-[#f3e7c9] border-none">
      <CardContent className="flex items-center gap-3 py-4">
        <Link href="/nest" className="shrink-0">
          {species ? (
            <BirdSprite species={species} size={64} mood={mood} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-2xl">🥚</div>
          )}
        </Link>
        <div className="min-w-0">
          <p className="text-lg font-semibold tabular-nums text-[#5a3d1a]">{seeds} 🌱</p>
          <p className="truncate text-xs text-[#7a5a2a]">
            {species ? `${nickname || species.name} is ${moodLabel ?? "waiting"}` : "Hatch your first bird"}
          </p>
          <Link href="/nest" className="text-xs font-medium text-[#9a6b1f] underline-offset-2 hover:underline">
            Open your nest →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
