import { Flame, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdherenceCard({
  total,
  done,
  streak,
}: {
  total: number;
  done: number;
  streak: number;
}) {
  if (total === 0 && streak === 0) return null;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          This week
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
            <span className="text-sm text-muted-foreground">
              {done} of {total} done
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {streak > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-[#e08a3c]" aria-hidden />
            {streak}-day streak — keep it going.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
