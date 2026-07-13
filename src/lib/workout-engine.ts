import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWorkoutPlan, type WorkoutContext } from "@/lib/integrations/fitness-ai";
import { detectRedFlags, redFlagGuidance } from "@/lib/fitness-safety";
import { computeAutoregulation } from "@/lib/autoregulation";
import { audit } from "@/lib/audit";
import type { UserWorkout } from "@/lib/fitness";
import { AI_CONSENT_REQUIRED_ERROR, getAiProcessingPermit } from "@/lib/integrations/ai-permit";

export type WorkoutGenResult =
  | { ok: true; workout: UserWorkout }
  | { ok: false; blocked: true; message: string }
  | { ok: false; error: string };

/**
 * Gather a user's profile + equipment + limitations + Oura recovery + recent
 * workouts, run the safety pre-check, generate a structured workout, and store
 * it. Uses the service role so it works from server actions AND the planner.
 * Auth + rate limiting are the caller's responsibility.
 */
export async function generateWorkoutForUser(
  userId: string,
  opts: { timeAvailableMinutes?: number; soreness?: string; date?: string } = {}
): Promise<WorkoutGenResult> {
  const permit = await getAiProcessingPermit(userId);
  if (!permit) return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  const admin = createAdminClient();

  const [{ data: prefs }, { data: equip }, { data: lims }, { data: metrics }, { data: recent }] =
    await Promise.all([
      admin
        .from("user_preferences")
        .select("fitness_goal, activity_level, exercise_frequency")
        .eq("user_id", userId)
        .maybeSingle<{
          fitness_goal: string | null;
          activity_level: string | null;
          exercise_frequency: string | null;
        }>(),
      admin
        .from("user_equipment")
        .select("name")
        .eq("user_id", userId)
        .returns<{ name: string }[]>(),
      admin
        .from("user_limitations")
        .select("description")
        .eq("user_id", userId)
        .returns<{ description: string }[]>(),
      admin
        .from("health_metrics")
        .select("date, sleep_duration_min, hrv_avg, resting_hr, readiness_score")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(7)
        .returns<
          {
            date: string;
            sleep_duration_min: number | null;
            hrv_avg: number | null;
            resting_hr: number | null;
            readiness_score: number | null;
          }[]
        >(),
      admin
        .from("user_workouts")
        .select("date, title, intensity")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(5)
        .returns<{ date: string; title: string; intensity: string | null }[]>(),
    ]);

  const { data: checkins } = await admin
    .from("subjective_checkins")
    .select("date, soreness, stress")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(5)
    .returns<{ date: string; soreness: number | null; stress: number | null }[]>();

  const metric = (metrics ?? [])[0] ?? null;
  const limitations = (lims ?? []).map((l) => l.description);
  const soreness = opts.soreness?.trim() || null;

  // Multi-day autoregulation from recovery + subjective trends.
  const autoregulation = permit.consent.health
    ? computeAutoregulation(
        (metrics ?? []).map((m) => m.readiness_score),
        permit.consent.checkin ? (checkins ?? []).map((c) => c.soreness) : [],
        permit.consent.checkin ? (checkins ?? []).map((c) => c.stress) : []
      )
    : null;

  const flags = detectRedFlags([soreness, ...limitations].filter(Boolean).join(". "));
  if (flags.length > 0) return { ok: false, blocked: true, message: redFlagGuidance(flags) };

  const ctx: WorkoutContext = {
    goal: prefs?.fitness_goal ?? null,
    fitnessLevel: prefs?.activity_level ?? null,
    timeAvailableMinutes:
      opts.timeAvailableMinutes && opts.timeAvailableMinutes > 0 ? opts.timeAvailableMinutes : 40,
    equipment: (equip ?? []).map((e) => e.name),
    limitations,
    recovery:
      permit.consent.health && metric
        ? {
            sleepHours:
              metric.sleep_duration_min != null
                ? Math.round((metric.sleep_duration_min / 60) * 10) / 10
                : null,
            hrv: metric.hrv_avg,
            restingHeartRate: metric.resting_hr,
            readiness: metric.readiness_score,
            steps: null,
          }
        : null,
    recentWorkouts: (recent ?? []).map((w) => ({
      date: w.date,
      title: w.title,
      intensity: w.intensity,
    })),
    soreness: permit.consent.checkin ? soreness : null,
    autoregulation,
  };

  const plan = await generateWorkoutPlan(permit, ctx);
  if (!plan) return { ok: false, error: "Couldn't build a workout right now — please try again." };

  const { data: stored, error } = await admin
    .from("user_workouts")
    .insert({
      user_id: userId,
      ...(opts.date ? { date: opts.date } : {}),
      title: plan.workout_title,
      intensity: plan.intensity,
      reasoning_summary: plan.reasoning_summary,
      estimated_duration_minutes: plan.estimated_duration_minutes,
      plan,
      status: "planned",
    })
    .select("*")
    .single<UserWorkout>();
  if (error || !stored) return { ok: false, error: "Couldn't save the workout." };

  await audit(userId, "workout.generated");
  return { ok: true, workout: stored };
}
