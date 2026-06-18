import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Loads a user's friends, pending requests, and — for accepted friends — a
 * snapshot of whatever each friend has chosen to share. Cross-user reads use
 * the admin client AFTER confirming the friendship and reading the friend's
 * own share settings, so nothing leaks beyond what they opted into.
 */

export interface FriendCard {
  friendshipId: string;
  userId: string;
  name: string;
  shares: { activity: boolean; calendar: boolean; goals: boolean };
  stepsAvg: number | null;
  activityScore: number | null;
  goal: string | null;
  eventsToday: number | null;
}

export interface FriendRequestCard {
  friendshipId: string;
  userId: string;
  name: string;
}

export interface FriendSettings {
  share_activity: boolean;
  share_calendar: boolean;
  share_goals: boolean;
}

export interface FriendsData {
  friends: FriendCard[];
  incoming: FriendRequestCard[];
  outgoing: FriendRequestCard[];
  settings: FriendSettings;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

const NO_SHARING: FriendSettings = { share_activity: false, share_calendar: false, share_goals: false };

export async function loadFriends(userId: string): Promise<FriendsData> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: rows } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .returns<FriendshipRow[]>();

  const all = rows ?? [];
  const accepted = all.filter((r) => r.status === "accepted");
  const incoming = all.filter((r) => r.status === "pending" && r.addressee_id === userId);
  const outgoing = all.filter((r) => r.status === "pending" && r.requester_id === userId);

  const otherId = (r: FriendshipRow) => (r.requester_id === userId ? r.addressee_id : r.requester_id);
  const friendIds = accepted.map(otherId);
  const allIds = Array.from(
    new Set([...friendIds, ...incoming.map((r) => r.requester_id), ...outgoing.map((r) => r.addressee_id)])
  );

  const nameMap = new Map<string, string>();
  if (allIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", allIds)
      .returns<{ id: string; display_name: string | null }[]>();
    for (const p of profiles ?? []) nameMap.set(p.id, p.display_name || "Daybreak friend");
  }
  const nameOf = (id: string) => nameMap.get(id) ?? "Daybreak friend";

  const settingsMap = new Map<string, FriendSettings>();
  if (friendIds.length) {
    const { data: fs } = await admin
      .from("friend_settings")
      .select("user_id, share_activity, share_calendar, share_goals")
      .in("user_id", friendIds)
      .returns<({ user_id: string } & FriendSettings)[]>();
    for (const s of fs ?? [])
      settingsMap.set(s.user_id, {
        share_activity: s.share_activity,
        share_calendar: s.share_calendar,
        share_goals: s.share_goals,
      });
  }

  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const friends: FriendCard[] = [];
  for (const r of accepted) {
    const fid = otherId(r);
    const s = settingsMap.get(fid) ?? NO_SHARING;
    let stepsAvg: number | null = null;
    let activityScore: number | null = null;
    let goal: string | null = null;
    let eventsToday: number | null = null;

    if (s.share_activity) {
      const { data: hm } = await admin
        .from("health_metrics")
        .select("steps, activity_score, date")
        .eq("user_id", fid)
        .gte("date", since)
        .order("date", { ascending: true })
        .returns<{ steps: number | null; activity_score: number | null; date: string }[]>();
      const steps = (hm ?? []).map((x) => x.steps).filter((n): n is number => typeof n === "number");
      stepsAvg = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null;
      const scores = (hm ?? []).map((x) => x.activity_score).filter((n): n is number => typeof n === "number");
      activityScore = scores.length ? scores[scores.length - 1] : null;
    }
    if (s.share_goals) {
      const { data: prefs } = await admin
        .from("user_preferences")
        .select("fitness_goal")
        .eq("user_id", fid)
        .maybeSingle<{ fitness_goal: string | null }>();
      goal = prefs?.fitness_goal ?? null;
    }
    if (s.share_calendar) {
      const { count } = await admin
        .from("schedule_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", fid)
        .gte("starts_at", `${today}T00:00:00.000Z`)
        .lte("starts_at", `${today}T23:59:59.999Z`);
      eventsToday = count ?? 0;
    }

    friends.push({
      friendshipId: r.id,
      userId: fid,
      name: nameOf(fid),
      shares: { activity: s.share_activity, calendar: s.share_calendar, goals: s.share_goals },
      stepsAvg,
      activityScore,
      goal,
      eventsToday,
    });
  }

  const { data: mySettings } = await supabase
    .from("friend_settings")
    .select("share_activity, share_calendar, share_goals")
    .eq("user_id", userId)
    .maybeSingle<FriendSettings>();

  return {
    friends,
    incoming: incoming.map((r) => ({ friendshipId: r.id, userId: r.requester_id, name: nameOf(r.requester_id) })),
    outgoing: outgoing.map((r) => ({ friendshipId: r.id, userId: r.addressee_id, name: nameOf(r.addressee_id) })),
    settings: mySettings ?? NO_SHARING,
  };
}
