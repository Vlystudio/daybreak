"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import {
  subjectiveCheckinToObservations,
  upsertHealthObservations,
} from "@/lib/health/observations";
import type { ActionResult } from "@/actions/schedule";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

const scale = z.number().int().min(1).max(5).nullable();

const checkinSchema = z.object({
  mood: scale,
  energy: scale,
  stress: scale,
  soreness: scale,
  note: z.string().max(500).trim().optional(),
});

export type SubjectiveCheckinInput = z.infer<typeof checkinSchema>;

/** Log (or update) today's subjective check-in. One row per local day. */
export async function logSubjectiveCheckin(input: SubjectiveCheckinInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those values look off — use 1 to 5." };

  const supabase = await createClient();

  // Resolve "today" in the user's timezone so a late-night check-in lands on the right day.
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string }>();
  const today = localDate(profile?.timezone ?? "UTC");

  const { error } = await supabase.from("subjective_checkins").upsert(
    {
      user_id: user.id,
      date: today,
      mood: parsed.data.mood,
      energy: parsed.data.energy,
      stress: parsed.data.stress,
      soreness: parsed.data.soreness,
      note: parsed.data.note?.length ? parsed.data.note : null,
    },
    { onConflict: "user_id,date" }
  );

  if (error) return { ok: false, error: "Couldn't save your check-in." };

  // Dual-write source-tagged manual observations. Best-effort.
  try {
    await upsertHealthObservations(
      subjectiveCheckinToObservations(user.id, { date: today, ...parsed.data })
    );
  } catch (err) {
    safeLog("error", "checkin.observation_dual_write_failed", { errorClass: errorClass(err) });
  }

  await audit(user.id, "checkin.logged");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** YYYY-MM-DD for "now" in the given IANA timezone. */
function localDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
