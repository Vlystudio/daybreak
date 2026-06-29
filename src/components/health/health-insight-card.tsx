"use client";

import { useState } from "react";
import { CheckCircle2, Info, Eye, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "@/components/health/health-confidence-badge";
import { metricLabel } from "@/components/health/health-display";
import type { HealthInsight, InsightSeverity } from "@/lib/health/types";

/**
 * One calm, practical health insight. Severity is gentle (a colored accent and
 * icon, never an alarm), confidence is always shown, and the deterministic
 * reasons are tucked behind a "Why?" toggle (progressive disclosure).
 */

const SEVERITY: Record<InsightSeverity, { accent: string; icon: typeof Info; iconColor: string }> =
  {
    positive: { accent: "border-l-sage", icon: CheckCircle2, iconColor: "text-sage" },
    neutral: { accent: "border-l-border", icon: Info, iconColor: "text-muted-foreground" },
    watch: { accent: "border-l-honey", icon: Eye, iconColor: "text-honey" },
    warning: { accent: "border-l-destructive", icon: AlertTriangle, iconColor: "text-destructive" },
  };

export function HealthInsightCard({ insight }: { insight: HealthInsight }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[insight.severity];
  const Icon = s.icon;
  const hasDetails = insight.reasons.length > 0 || (insight.sourceNotes?.length ?? 0) > 0;

  return (
    <div className={cn("border-border bg-card rounded-xl border border-l-4 p-3.5", s.accent)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconColor)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{insight.title}</p>
            <ConfidenceBadge confidence={insight.confidence} reasons={insight.reasons} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{insight.message}</p>

          {insight.relatedMetrics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insight.relatedMetrics.map((m) => (
                <span
                  key={m}
                  className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium"
                >
                  {metricLabel(m)}
                </span>
              ))}
            </div>
          )}

          {hasDetails && (
            <>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs font-medium"
                aria-expanded={open}
              >
                Why?
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                  aria-hidden
                />
              </button>
              {open && (
                <div className="text-muted-foreground mt-1.5 space-y-1 text-xs">
                  {insight.reasons.map((r, i) => (
                    <p key={`r${i}`} className="flex gap-1.5">
                      <span aria-hidden>·</span>
                      <span>{r}</span>
                    </p>
                  ))}
                  {insight.sourceNotes?.map((n, i) => (
                    <p key={`n${i}`} className="text-muted-foreground/80 flex gap-1.5 italic">
                      <span aria-hidden>·</span>
                      <span>{n}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
