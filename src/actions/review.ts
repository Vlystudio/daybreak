"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/actions/schedule";

const reviewSchema = z.object({
  day_rating: z.number().int().min(1).max(5).nullable(),
  went_well: z.string().trim().max(500).optional(),
  to_improve: z.string().trim().max(500).optional(),
  tomorrow_intention: z.string().trim().max(300).optional(),
});

export type EveningReviewInput = z.input<typeof reviewSchema>;

/** Save (or update) today's evening review. One row per local day. */
export async function logEveningReview(input: EveningReviewInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't look right." };

  const d = parsed.data;
  if (d.day_rating == null && !d.went_well?.length && !d.to_improve?.length && !d.tomorrow_intention?.length) {
    return { ok: false, error: "Add a rating or a note first." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const today = localDate(profile?.timezone ?? "UTC");

  const { error } = await supabase.from("evening_reviews").upsert(
    {
      user_id: user.id,
      date: today,
      day_rating: d.day_rating,
      went_well: d.went_well?.length ? d.went_well : null,
      to_improve: d.to_improve?.length ? d.to_improve : null,
      tomorrow_intention: d.tomorrow_intention?.length ? d.tomorrow_intention : null,
    },
    { onConflict: "user_id,date" }
  );

  if (error) return { ok: false, error: "Couldn't save your review." };

  await audit(user.id, "review.logged");
  revalidatePath("/dashboard");
  return { ok: true };
}

function localDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date()
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
