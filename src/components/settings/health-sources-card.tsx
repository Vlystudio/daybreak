import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProviderState } from "@/lib/health/providers";

/**
 * Read-only overview of every health source Daybreak understands and its state
 * for this user. Connecting/disconnecting active wearables stays in the
 * Connections card. The release UI receives only supported V1 sources.
 */

const STATE_BADGE: Record<ProviderState, "sage" | "secondary" | "outline"> = {
  Connected: "sage",
  Available: "secondary",
  "Not configured": "outline",
};

export interface HealthSourceRow {
  id: string;
  label: string;
  description: string;
  state: ProviderState;
  note?: string;
}

export function HealthSourcesCard({ sources }: { sources: HealthSourceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="text-sage h-4 w-4" aria-hidden /> Health sources
        </CardTitle>
        <CardDescription>
          Supported sources for wellness signals. Your plan also works with only a daily check-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-muted-foreground text-xs">{s.note ?? s.description}</p>
            </div>
            <Badge variant={STATE_BADGE[s.state]} className="shrink-0">
              {s.state}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
