"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";
import { SOCIAL_DISABLED_ERROR, SOCIAL_FEATURES_ENABLED } from "@/lib/features";

const emailSchema = z.email();

export async function sendFriendRequest(email: string): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const parsed = emailSchema.safeParse(String(email).trim());
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };

  const admin = createAdminClient();
  const { data: targetId } = await admin.rpc("find_user_id_by_email", { p_email: parsed.data });
  if (!targetId || typeof targetId !== "string") {
    return { ok: false, error: "No Daybreak user with that email." };
  }
  if (targetId === user.id) return { ok: false, error: "That's your own email." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status, requester_id")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`
    )
    .maybeSingle<{ id: string; status: string; requester_id: string }>();
  if (existing) {
    if (existing.status === "accepted") return { ok: false, error: "You're already friends." };
    return {
      ok: false,
      error:
        existing.requester_id === user.id
          ? "You've already sent them a request."
          : "They already sent you a request — check your invites below.",
    };
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id: targetId, status: "pending" });
  if (error) return { ok: false, error: "Couldn't send the request." };

  await audit(user.id, "friend.requested");
  revalidatePath("/friends");
  return { ok: true };
}

export async function respondToRequest(id: string, accept: boolean): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid request" };

  const supabase = await createClient();
  if (accept) {
    const { data, error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Couldn't accept the request." };
    await audit(user.id, "friend.accepted");
  } else {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", id)
      .eq("addressee_id", user.id);
    if (error) return { ok: false, error: "Couldn't decline the request." };
  }

  revalidatePath("/friends");
  return { ok: true };
}

export async function removeFriend(id: string): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  await requireUser();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid" };

  const supabase = await createClient();
  // RLS limits deletes to friendships you're part of.
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't update that." };

  revalidatePath("/friends");
  return { ok: true };
}

export async function saveFriendSettings(input: {
  shareActivity: boolean;
  shareCalendar: boolean;
  shareGoals: boolean;
}): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("friend_settings").upsert(
    {
      user_id: user.id,
      share_activity: !!input.shareActivity,
      share_calendar: !!input.shareCalendar,
      share_goals: !!input.shareGoals,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: "Couldn't save your sharing settings." };

  revalidatePath("/friends");
  return { ok: true };
}
