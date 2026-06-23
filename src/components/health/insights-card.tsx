import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/insights";

export function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Sparkles className="h-4 w-4 text-honey" aria-hidden /> Patterns in your data
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((i) => {
          const Icon = i.tone === "positive" ? TrendingUp : AlertCircle;
          return (
            <Card key={i.id} className={cn("border-l-4", i.tone === "positive" ? "border-l-sage" : "border-l-honey")}>
              <CardHeader className="pb-1.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon
                    className={cn("h-4 w-4 shrink-0", i.tone === "positive" ? "text-sage" : "text-honey")}
                    aria-hidden
                  />
                  {i.headline}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{i.detail}</p>
                <p className="text-xs text-muted-foreground/70">
                  {i.strength === "strong" ? "Strong" : "Moderate"} pattern · {i.n} days
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Patterns are correlations in your own data, not medical advice — they show what tends to move together, not
        cause and effect.
      </p>
    </section>
  );
}
