"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addDays, format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/schedule";

const createSchema = z.object({
  title: z.string().trim().min(1, "Name your challenge").max(100),
  metric: z.enum(["steps", "active_calories", "habits", "protein"]),
  lengthDays: z.coerce.number().int().refine((n) => [7, 14, 30].includes(n), { message: "Pick a length" }),
  friendIds: z.array(z.string().uuid()).min(1, "Invite at least one friend").max(20),
});

export async function createCompetition(input: {
  title: string;
  metric: string;
  lengthDays: number;
  friendIds: string[];
}): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Slow down a moment." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid challenge" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted")
    .returns<{ requester_id: string; addressee_id: string }[]>();
  const friendSet = new Set(
    (friendships ?? []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
  );
  const invited = Array.from(new Set(d.friendIds.filter((id) => friendSet.has(id) && id !== user.id)));
  if (invited.length === 0) return { ok: false, error: "Pick friends you're connected with." };

  const start = format(new Date(), "yyyy-MM-dd");
  const end = format(addDays(new Date(), d.lengthDays - 1), "yyyy-MM-dd");

  const admin = createAdminClient();
  const { data: comp, error } = await admin
    .from("competitions")
    .insert({ creator_id: user.id, title: d.title, metric: d.metric, start_date: start, end_date: end, status: "active" })
    .select("id")
    .single<{ id: string }>();
  if (error || !comp) return { ok: false, error: "Couldn't create the challenge." };

  const rows = [
    { competition_id: comp.id, user_id: user.id, status: "joined" },
    ...invited.map((id) => ({ competition_id: comp.id, user_id: id, status: "invited" })),
  ];
  const { error: pErr } = await admin.from("competition_participants").insert(rows);
  if (pErr) {
    await admin.from("competitions").delete().eq("id", comp.id);
    return { ok: false, error: "Couldn't set up the challenge." };
  }

  await audit(user.id, "competition.created", { metadata: { metric: d.metric, participants: rows.length } });
  revalidatePath("/friends");
  return { ok: true };
}

export async function joinCompetition(competitionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(competitionId).success) return { ok: false, error: "Invalid challenge" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competition_participants")
    .update({ status: "joined" })
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .eq("status", "invited")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't join — the invite may be gone." };

  await audit(user.id, "competition.joined");
  revalidatePath("/friends");
  return { ok: true };
}

export async function declineCompetition(competitionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(competitionId).success) return { ok: false, error: "Invalid challenge" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("competition_participants")
    .update({ status: "declined" })
    .eq("competition_id", competitionId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't decline." };

  revalidatePath("/friends");
  return { ok: true };
}
