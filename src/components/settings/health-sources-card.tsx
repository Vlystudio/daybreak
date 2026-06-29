import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProviderState } from "@/lib/health/providers";

/**
 * Read-only overview of every health source Daybreak understands and its state
 * for this user. Connecting/disconnecting active wearables stays in the
 * Connections card; this surface explains the full landscape — including
 * Planned (Google Health) and Gated (Garmin) sources — without inventing auth
 * flows that don't exist yet.
 */

const STATE_BADGE: Record<ProviderState, "sage" | "secondary" | "honey" | "outline"> = {
  Connected: "sage",
  Available: "secondary",
  Planned: "honey",
  Gated: "outline",
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
          Where Daybreak reads your wellness signals. Your plan works with any of these — or just a
          daily check-in.
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
        <p className="text-muted-foreground pt-1 text-[11px]">
          Planned and gated sources aren&apos;t available yet — Daybreak never depends on them for
          your plan.
        </p>
      </CardContent>
    </Card>
  );
}
