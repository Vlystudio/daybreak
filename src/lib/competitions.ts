import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Assembles a user's challenges with live standings. Each joined participant's
 * score is the sum of the chosen metric over the challenge window, read via the
 * admin client (participants opted in by joining).
 */

export type CompetitionMetric = "steps" | "active_calories" | "habits" | "protein";

/** Sum the chosen metric for a participant over the challenge window. */
async function scoreParticipant(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  metric: CompetitionMetric,
  startDate: string,
  endDate: string
): Promise<number> {
  if (metric === "habits") {
    const { count } = await admin
      .from("habit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);
    return count ?? 0;
  }
  if (metric === "protein") {
    const { data } = await admin
      .from("food_logs")
      .select("protein_g")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<{ protein_g: number | null }[]>();
    return (data ?? []).reduce((sum, r) => sum + (r.protein_g ?? 0), 0);
  }
  // steps / active_calories come from Oura/Fitbit daily metrics.
  const { data: hm } = await admin
    .from("health_metrics")
    .select(metric)
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .returns<Record<string, number | null>[]>();
  return (hm ?? []).reduce((sum, row) => sum + (typeof row[metric] === "number" ? (row[metric] as number) : 0), 0);
}

export interface Standing {
  userId: string;
  name: string;
  score: number;
  isMe: boolean;
  joined: boolean;
}

export interface CompetitionCard {
  id: string;
  title: string;
  metric: CompetitionMetric;
  startDate: string;
  endDate: string;
  status: string;
  myStatus: "joined" | "invited" | "declined" | null;
  isCreator: boolean;
  standings: Standing[];
  daysLeft: number;
}

export async function loadCompetitions(userId: string): Promise<CompetitionCard[]> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: myParts } = await supabase
    .from("competition_participants")
    .select("competition_id, status")
    .eq("user_id", userId)
    .returns<{ competition_id: string; status: string }[]>();

  const ids = Array.from(new Set((myParts ?? []).map((p) => p.competition_id)));
  if (ids.length === 0) return [];
  const myStatus = new Map((myParts ?? []).map((p) => [p.competition_id, p.status]));

  const [{ data: comps }, { data: parts }] = await Promise.all([
    admin
      .from("competitions")
      .select("id, creator_id, title, metric, start_date, end_date, status, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          creator_id: string;
          title: string;
          metric: CompetitionMetric;
          start_date: string;
          end_date: string;
          status: string;
        }[]
      >(),
    admin
      .from("competition_participants")
      .select("competition_id, user_id, status")
      .in("competition_id", ids)
      .returns<{ competition_id: string; user_id: string; status: string }[]>(),
  ]);

  const participantIds = Array.from(new Set((parts ?? []).map((p) => p.user_id)));
  const nameMap = new Map<string, string>();
  if (participantIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", participantIds)
      .returns<{ id: string; display_name: string | null }[]>();
    for (const p of profiles ?? []) nameMap.set(p.id, p.display_name || "Friend");
  }

  const cards: CompetitionCard[] = [];
  for (const c of comps ?? []) {
    const members = (parts ?? []).filter((p) => p.competition_id === c.id && p.status !== "declined");
    const standings: Standing[] = [];
    for (const p of members) {
      let score = 0;
      if (p.status === "joined") {
        score = await scoreParticipant(admin, p.user_id, c.metric, c.start_date, c.end_date);
      }
      standings.push({
        userId: p.user_id,
        name: nameMap.get(p.user_id) ?? "Friend",
        score: Math.round(score),
        isMe: p.user_id === userId,
        joined: p.status === "joined",
      });
    }
    standings.sort((a, b) => b.score - a.score);

    const daysLeft = Math.max(
      0,
      Math.ceil((Date.parse(`${c.end_date}T23:59:59Z`) - Date.now()) / 86_400_000)
    );

    cards.push({
      id: c.id,
      title: c.title,
      metric: c.metric,
      startDate: c.start_date,
      endDate: c.end_date,
      status: c.status,
      myStatus: (myStatus.get(c.id) as CompetitionCard["myStatus"]) ?? null,
      isCreator: c.creator_id === userId,
      standings,
      daysLeft,
    });
  }

  return cards;
}
