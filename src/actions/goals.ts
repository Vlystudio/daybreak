"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { KG_PER_LB } from "@/lib/goals";
import type { ActionResult } from "@/actions/schedule";

const createSchema = z.object({
  metric: z.enum(["weight", "body_fat"]),
  /** Current and target in display units: lb for weight, % for body fat. */
  currentDisplay: z.number().positive().max(2000),
  targetDisplay: z.number().positive().max(2000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createGoal(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those values look off." };
  const { metric, currentDisplay, targetDisplay, targetDate } = parsed.data;

  const toCanonical = (v: number) => (metric === "weight" ? v * KG_PER_LB : v);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  if (targetDate && targetDate <= today) {
    return { ok: false, error: "Pick a target date in the future." };
  }

  // Replace any existing active goal for this metric so progress stays unambiguous.
  await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("metric", metric)
    .eq("status", "active");

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    metric,
    start_value: toCanonical(currentDisplay),
    target_value: toCanonical(targetDisplay),
    start_date: today,
    target_date: targetDate ?? null,
  });
  if (error) return { ok: false, error: "Couldn't create that goal." };

  await audit(user.id, "goal.created", { metadata: { metric } });
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown goal" };

  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that goal." };

  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}
