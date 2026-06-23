"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sendPushToUser } from "@/lib/push";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";

const PRESETS: Record<"cheer" | "reminder", string> = {
  cheer: "is cheering you on today 💪",
  reminder: "nudged you to check in 👋",
};

const sendSchema = z.object({
  toUserId: uuidSchema,
  kind: z.enum(["cheer", "reminder"]),
  message: z.string().trim().max(200).optional(),
});

/** Send a cheer/reminder to an accepted friend, delivered via push. */
export async function sendNudge(input: z.input<typeof sendSchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid nudge" };
  const { toUserId, kind, message } = parsed.data;
  if (toUserId === user.id) return { ok: false, error: "You can't nudge yourself." };

  // Verify an accepted friendship in either direction (RLS lets us read our own).
  const supabase = await createClient();
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${toUserId}),and(requester_id.eq.${toUserId},addressee_id.eq.${user.id})`
    )
    .maybeSingle<{ id: string }>();
  if (!friendship) return { ok: false, error: "You can only nudge friends." };

  const admin = createAdminClient();
  const { error } = await admin.from("nudges").insert({
    from_user_id: user.id,
    to_user_id: toUserId,
    kind,
    message: message?.length ? message : null,
  });
  if (error) return { ok: false, error: "Couldn't send that nudge." };

  // Deliver as a push (best-effort; the recipient also sees it in-app).
  const { data: me } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string }>();
  const fromName = (me?.display_name ?? "").trim() || "A friend";
  const body = message?.length ? `${fromName}: ${message}` : `${fromName} ${PRESETS[kind]}`;
  await sendPushToUser(toUserId, { title: "👋 A nudge from a friend", body, url: "/dashboard" });

  await audit(user.id, "nudge.sent", { metadata: { kind } });
  revalidatePath("/friends");
  return { ok: true };
}

/** Mark all of the current user's unread nudges as read. */
export async function markNudgesRead(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("nudges")
    .update({ read_at: new Date().toISOString() })
    .eq("to_user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: "Couldn't update nudges." };

  revalidatePath("/dashboard");
  return { ok: true };
}
