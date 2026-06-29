import { Activity, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanHealthSnapshot } from "@/lib/health/plan-input";

/**
 * Plan confidence meter + source chips. Helpful, never medical: it tells the
 * user how much of today's plan is grounded in fresh data and which sources fed
 * it. Fed entirely by the normalized snapshot, so it's identical across Oura,
 * Apple Health, Fitbit/Google, or a manual check-in.
 */

const LABEL_BADGE = { High: "sage", Medium: "honey", Low: "outline" } as const;
const BAR_TONE = { High: "bg-sage", Medium: "bg-honey", Low: "bg-muted-foreground/50" } as const;

export function PlanConfidence({ snapshot }: { snapshot: PlanHealthSnapshot }) {
  const { confidence, sources } = snapshot;
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Activity className="text-muted-foreground h-4 w-4" aria-hidden /> Plan confidence
          </span>
          <Badge variant={LABEL_BADGE[confidence.label]}>{confidence.label}</Badge>
        </div>

        <div
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={confidence.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Plan confidence"
        >
          <div
            className={cn("h-full rounded-full transition-all", BAR_TONE[confidence.label])}
            style={{ width: `${Math.max(4, confidence.score)}%` }}
          />
        </div>

        <p className="text-muted-foreground text-xs">{confidence.explanation}</p>

        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-muted-foreground text-[11px]">Sources</span>
            {sources.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[11px] font-normal">
                {s.label}
              </Badge>
            ))}
          </div>
        )}

        {snapshot.suggestCheckin && (
          <p className="bg-honey-soft/50 text-foreground/80 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]">
            <Sparkles className="text-honey h-3.5 w-3.5 shrink-0" aria-hidden />
            Add today&apos;s check-in below to sharpen your plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
