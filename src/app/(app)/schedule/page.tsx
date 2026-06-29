import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "@/components/schedule/schedule-view";
import type { ScheduleEvent } from "@/lib/types";

export const metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

function eventWindow(): { start: Date; end: Date } {
  const now = Date.now();
  return { start: new Date(now - 28 * 86_400_000), end: new Date(now + 56 * 86_400_000) };
}

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { start: windowStart, end: windowEnd } = eventWindow();

  const [{ data: events }, { data: membership }] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .gte("starts_at", windowStart.toISOString())
      .lt("starts_at", windowEnd.toISOString())
      .order("starts_at", { ascending: true })
      .returns<ScheduleEvent[]>(),
    supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle<{ household_id: string }>(),
  ]);

  return (
    <ScheduleView
      events={events ?? []}
      currentUserId={user.id}
      hasHousehold={membership !== null}
    />
  );
}
