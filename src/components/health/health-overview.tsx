"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HeartPulse, Moon, Footprints, Brain, Sparkles, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/health/health-confidence-badge";
import { HealthInsightCard } from "@/components/health/health-insight-card";
import {
  RECOVERY_DISPLAY,
  ACTIVITY_DISPLAY,
  STRESS_DISPLAY,
} from "@/components/health/health-display";
import { analyzeHealth } from "@/actions/health";
import { syncNow } from "@/actions/settings";
import type { HealthAnalysis } from "@/lib/integrations/ai";
import type { HealthUnderstandingResult } from "@/lib/health/types";

/**
 * Overview answers four questions in five seconds: How am I doing? What changed?
 * How confident is Daybreak? What's worth attention? Summary first, charts later.
 */
export function HealthOverview({ understanding }: { understanding: HealthUnderstandingResult }) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [syncing, startSync] = useTransition();

  const { summary, dataQuality } = understanding;
  const hasWearable = dataQuality.connectedSources.some(
    (s) => s === "oura" || s === "fitbit" || s === "apple_health"
  );

  function analyze() {
    startAnalyze(async () => {
      const res = await analyzeHealth();
      if (res.ok) setAnalysis(res.analysis);
      else toast.error(res.error);
    });
  }
  function sync() {
    startSync(async () => {
      const res = await syncNow();
      if (res.ok) {
        toast.success("Synced your latest data.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const recovery = RECOVERY_DISPLAY[summary.recoveryStatus];
  const sleep = RECOVERY_DISPLAY[summary.sleepStatus];
  const activity = ACTIVITY_DISPLAY[summary.activityStatus];
  const stress = STRESS_DISPLAY[summary.stressStatus];

  const tiles = [
    {
      name: "Recovery",
      icon: HeartPulse,
      color: "text-peach",
      status: recovery.label,
      variant: recovery.variant,
    },
    { name: "Sleep", icon: Moon, color: "text-sky", status: sleep.label, variant: sleep.variant },
    {
      name: "Activity",
      icon: Footprints,
      color: "text-sage",
      status: activity.label,
      variant: activity.variant,
    },
    {
      name: "Stress",
      icon: Brain,
      color: "text-honey",
      status: stress.label,
      variant: stress.variant,
    },
  ];

  return (
    <div className="space-y-4">
      {!hasWearable && (
        <Card className="border-l-honey border-l-4">
          <CardContent className="flex flex-col items-start gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">No tracker connected.</span>{" "}
              <span className="text-muted-foreground">
                Connect Oura or Apple Health for recovery, sleep, and activity insights.
              </span>
            </p>
            <Button asChild size="sm">
              <Link href="/settings">
                <Link2 aria-hidden /> Connect a tracker
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today at a glance */}
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-sm font-semibold">Today at a glance</h2>
        <div className="flex items-center gap-2">
          <ConfidenceBadge
            confidence={dataQuality.overallConfidence}
            reasons={dataQuality.warnings}
          />
          {hasWearable && (
            <Button variant="ghost" size="sm" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.name}>
            <CardContent className="space-y-2 p-3.5">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <t.icon className={`h-4 w-4 ${t.color}`} aria-hidden />
                <span className="text-xs font-medium">{t.name}</span>
              </div>
              <Badge variant={t.variant}>{t.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What to pay attention to */}
      {summary.topInsights.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-semibold">Worth paying attention to</h2>
          <div className="space-y-2">
            {summary.topInsights.map((insight, i) => (
              <HealthInsightCard key={`${insight.type}-${i}`} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* AI explanation — secondary to the deterministic understanding above. */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="text-honey h-4 w-4" aria-hidden /> What your data suggests
          </CardTitle>
          <Button variant="secondary" size="sm" onClick={analyze} disabled={analyzing}>
            {analyzing ? "Analyzing…" : analysis ? "Refresh analysis" : "Analyze my trends"}
          </Button>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              <p className="text-sm">{analysis.summary}</p>
              {analysis.insights.length > 0 && (
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  {analysis.insights.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              )}
              {analysis.suggestions.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.suggestions.map((sg, idx) => (
                    <div key={idx} className="bg-muted/50 rounded-xl p-3">
                      <p className="text-sm font-medium">{sg.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-sm">{sg.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              A plain-language read of your fused trends — it explains the patterns above and may
              suggest small, practical changes. It&apos;s a summary, not a diagnosis.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Daybreak surfaces patterns in your own data, not medical advice. For anything that concerns
        you, talk to a healthcare professional.
      </p>
    </div>
  );
}
