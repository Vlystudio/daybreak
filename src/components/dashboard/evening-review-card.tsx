"use client";

import { useState, useTransition } from "react";
import { Moon, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { logEveningReview } from "@/actions/review";
import type { EveningReview } from "@/lib/types";

export function EveningReviewCard({ review }: { review: EveningReview | null }) {
  const [rating, setRating] = useState<number | null>(review?.day_rating ?? null);
  const [wentWell, setWentWell] = useState(review?.went_well ?? "");
  const [toImprove, setToImprove] = useState(review?.to_improve ?? "");
  const [intention, setIntention] = useState(review?.tomorrow_intention ?? "");
  const [pending, startTransition] = useTransition();
  const done = Boolean(review);

  function save() {
    startTransition(async () => {
      const result = await logEveningReview({
        day_rating: rating,
        went_well: wentWell.trim(),
        to_improve: toImprove.trim(),
        tomorrow_intention: intention.trim(),
      });
      if (result.ok) toast.success("Reflected. Tomorrow's plan will take this in.");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="border-none bg-gradient-to-br from-[#2a2342] to-[#3a2f57] text-[#ede9f7]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="h-4 w-4" aria-hidden />
          Evening review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm opacity-80">How was today?</p>
          <div className="flex gap-1.5" role="group" aria-label="Day rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} of 5`}
                aria-pressed={rating === n}
                onClick={() => setRating((r) => (r === n ? null : n))}
                className={cn(
                  "h-9 flex-1 rounded-lg border text-sm font-medium transition-colors",
                  rating === n
                    ? "border-white/80 bg-white/20"
                    : "border-white/20 text-white/60 hover:border-white/40"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder="What went well?"
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          rows={2}
          className="resize-none border-white/20 bg-white/10 placeholder:text-white/50"
        />
        <Textarea
          placeholder="What would you change?"
          value={toImprove}
          onChange={(e) => setToImprove(e.target.value)}
          rows={2}
          className="resize-none border-white/20 bg-white/10 placeholder:text-white/50"
        />
        <Input
          placeholder="One intention for tomorrow"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          className="border-white/20 bg-white/10 placeholder:text-white/50"
        />
        <Button
          onClick={save}
          disabled={pending}
          className="w-full bg-white/90 text-[#2a2342] hover:bg-white"
        >
          {done ? <Check aria-hidden /> : null}
          {pending ? "Saving…" : done ? "Update review" : "Save review"}
        </Button>
      </CardContent>
    </Card>
  );
}
