"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { ActionResult } from "@/actions/schedule";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

export type PushSubscriptionInput = z.infer<typeof subSchema>;

/** Store (or refresh) a browser's push subscription for the signed-in user. */
export async function savePushSubscription(input: PushSubscriptionInput): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid subscription" };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: "Couldn't enable push." };

  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().url().safeParse(endpoint).success) return { ok: false, error: "Invalid subscription" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't disable push." };

  return { ok: true };
}
