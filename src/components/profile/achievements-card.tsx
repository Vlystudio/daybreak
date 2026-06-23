import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/game/achievements";

export function AchievementsCard({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-honey" aria-hidden />
          Achievements
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {earned}/{achievements.length} unlocked
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {achievements.map((a) => {
            const pct = Math.min(100, Math.round((a.current / a.target) * 100));
            return (
              <div
                key={a.id}
                title={`${a.name} — ${a.desc}${a.earned ? "" : ` (${a.current}/${a.target})`}`}
                className={cn(
                  "flex flex-col items-center rounded-2xl border p-2.5 text-center transition-colors",
                  a.earned ? "border-honey/40 bg-honey-soft/50" : "border-border bg-muted/30"
                )}
              >
                <span className={cn("text-2xl", !a.earned && "opacity-40 grayscale")} aria-hidden>
                  {a.emoji}
                </span>
                <span className={cn("mt-1 line-clamp-2 text-[11px] font-medium leading-tight", !a.earned && "text-muted-foreground")}>
                  {a.name}
                </span>
                {!a.earned && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted-foreground/15">
                    <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
