"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { householdCreateSchema, householdJoinSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";
import { SOCIAL_DISABLED_ERROR, SOCIAL_FEATURES_ENABLED } from "@/lib/features";

/**
 * Household membership uses the admin client because creating/joining spans
 * tables the user can't insert into directly (invite-code validation happens
 * here, server-side). Every operation still keys off the session user id.
 */

export async function createHousehold(input: { name: string }): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many changes — try again shortly." };

  const parsed = householdCreateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "You're already in a household — leave it first." };

  const { data: household, error } = await admin
    .from("households")
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: "Couldn't create the household." };

  const { error: memberError } = await admin
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id, role: "owner" });
  if (memberError) {
    await admin.from("households").delete().eq("id", household.id);
    return { ok: false, error: "Couldn't create the household." };
  }

  await audit(user.id, "household.created", { entity: "household", entityId: household.id });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function joinHousehold(input: { inviteCode: string }): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();

  const limited = await rateLimit(`household-join:${user.id}`, { limit: 5, windowSeconds: 600 });
  if (!limited.ok) return { ok: false, error: "Too many attempts — wait a few minutes." };

  const parsed = householdJoinSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "You're already in a household — leave it first." };

  const { data: household } = await admin
    .from("households")
    .select("id")
    .eq("invite_code", parsed.data.inviteCode)
    .maybeSingle<{ id: string }>();
  if (!household) return { ok: false, error: "That invite code doesn't match any household." };

  const { error } = await admin
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id, role: "member" });
  if (error) return { ok: false, error: "Couldn't join the household." };

  await audit(user.id, "household.joined", { entity: "household", entityId: household.id });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function leaveHousehold(): Promise<ActionResult> {
  if (!SOCIAL_FEATURES_ENABLED) return { ok: false, error: SOCIAL_DISABLED_ERROR };
  const user = await requireUser();

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .maybeSingle<{ household_id: string; role: string }>();
  if (!membership) return { ok: false, error: "You're not in a household." };

  if (membership.role === "owner") {
    // Owner leaving dissolves the household (events keep their owners, the
    // household_id is nulled by the FK).
    await admin.from("households").delete().eq("id", membership.household_id);
  } else {
    await admin
      .from("household_members")
      .delete()
      .eq("household_id", membership.household_id)
      .eq("user_id", user.id);
  }

  await audit(user.id, "household.left", {
    entity: "household",
    entityId: membership.household_id,
  });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}
