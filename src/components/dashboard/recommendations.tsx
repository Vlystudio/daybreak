"use client";

import { Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DailySummary } from "@/lib/types";

const tints = ["bg-sage-soft", "bg-honey-soft", "bg-sky-soft", "bg-accent"];

export function Recommendations({ summary }: { summary: DailySummary | null }) {
  const recs = summary?.recommendations ?? [];
  if (recs.length === 0) return null;

  return (
    <section aria-labelledby="recs-heading">
      <h2 id="recs-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Leaf className="h-5 w-5 text-sage" aria-hidden />
        For you today
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recs.map((rec, i) => (
          <Card key={i} className={`border-none ${tints[i % tints.length]}`}>
            <CardContent className="p-5">
              <p className="font-semibold">{rec.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rec.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
