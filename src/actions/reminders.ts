"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";

const createSchema = z.object({
  kind: z.enum(["hydration", "wind_down", "move", "log_food", "checkin", "custom"]),
  hour: z.number().int().min(0).max(23),
  message: z.string().trim().max(140).optional(),
});

export async function createReminder(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a reminder and a time." };
  if (parsed.data.kind === "custom" && !parsed.data.message?.length) {
    return { ok: false, error: "Add a message for a custom reminder." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    user_id: user.id,
    kind: parsed.data.kind,
    hour: parsed.data.hour,
    message: parsed.data.message?.length ? parsed.data.message : null,
  });
  if (error) return { ok: false, error: "Couldn't create that reminder." };

  revalidatePath("/settings");
  return { ok: true };
}

export async function toggleReminder(id: string, enabled: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Unknown reminder" };

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").update({ enabled }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't update that reminder." };

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Unknown reminder" };

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that reminder." };

  revalidatePath("/settings");
  return { ok: true };
}
