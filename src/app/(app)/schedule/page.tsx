import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WeekCalendar } from "@/components/schedule/week-calendar";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-muted-foreground">
          Click an empty slot to plan something, or an event to edit it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-honey" aria-hidden /> Meals &amp; focus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden /> Workouts &amp; recovery
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-peach" aria-hidden /> Chores &amp; errands
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky" aria-hidden /> Google calendar
        </span>
        <span className="opacity-70">Faded = done</span>
      </div>
      <WeekCalendar
        events={events ?? []}
        currentUserId={user.id}
        hasHousehold={membership !== null}
      />
    </div>
  );
}
