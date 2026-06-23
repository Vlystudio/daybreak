import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/env";
import { sendEmail } from "@/lib/integrations/email";
import { computeInsights, type DailyRecord } from "@/lib/insights";
import { audit } from "@/lib/audit";

/**
 * Weekly "your week in review" email: this week's recovery, adherence, intake,
 * and the single biggest pattern from the insight engine — a Sunday recap that
 * bookends the daily briefings. Reuses the morning-email opt-in.
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export async function sendWeeklyDigestForUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const today = new Date();
  const since60 = isoDate(new Date(today.getTime() - 60 * 86_400_000));
  const weekAgo = isoDate(new Date(today.getTime() - 7 * 86_400_000));
  const twoWeeksAgo = isoDate(new Date(today.getTime() - 14 * 86_400_000));

  const [{ data: settings }, { data: profile }, { data: metrics }, { data: feelings }, { data: foods }, { data: habitLogs }, { data: events }, { data: userData }] =
    await Promise.all([
      admin.from("notification_settings").select("morning_email_enabled").eq("user_id", userId).maybeSingle<{ morning_email_enabled: boolean }>(),
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle<{ display_name: string }>(),
      admin.from("health_metrics").select("date, readiness_score, sleep_score, hrv_avg, resting_hr, steps").eq("user_id", userId).gte("date", since60).order("date", { ascending: false }).returns<{ date: string; readiness_score: number | null; sleep_score: number | null; hrv_avg: number | null; resting_hr: number | null; steps: number | null }[]>(),
      admin.from("subjective_checkins").select("date, mood, energy, stress, soreness").eq("user_id", userId).gte("date", since60).returns<{ date: string; mood: number | null; energy: number | null; stress: number | null; soreness: number | null }[]>(),
      admin.from("food_logs").select("date, calories, protein_g").eq("user_id", userId).gte("date", since60).returns<{ date: string; calories: number | null; protein_g: number | null }[]>(),
      admin.from("habit_logs").select("date").eq("user_id", userId).gte("date", weekAgo).returns<{ date: string }[]>(),
      admin.from("schedule_events").select("starts_at, completed_at").eq("user_id", userId).gte("starts_at", new Date(today.getTime() - 7 * 86_400_000).toISOString()).returns<{ starts_at: string; completed_at: string | null }[]>(),
      admin.auth.admin.getUserById(userId),
    ]);

  if (settings && !settings.morning_email_enabled) return false;
  const email = userData?.user?.email;
  if (!email) return false;

  const m = metrics ?? [];
  const inWeek = (d: string) => d >= weekAgo;
  const inPrior = (d: string) => d >= twoWeeksAgo && d < weekAgo;

  const readinessThis = avg(m.filter((x) => inWeek(x.date) && x.readiness_score != null).map((x) => x.readiness_score!));
  const readinessPrev = avg(m.filter((x) => inPrior(x.date) && x.readiness_score != null).map((x) => x.readiness_score!));
  const sleepThis = avg(m.filter((x) => inWeek(x.date) && x.sleep_score != null).map((x) => x.sleep_score!));
  const stepsThis = avg(m.filter((x) => inWeek(x.date) && x.steps != null).map((x) => x.steps!));

  // Nothing logged this week → skip (don't send an empty recap).
  const anyData = m.some((x) => inWeek(x.date)) || (feelings ?? []).some((f) => inWeek(f.date)) || (foods ?? []).some((f) => inWeek(f.date));
  if (!anyData) return false;

  const habitsDone = (habitLogs ?? []).length;
  const pastEvents = (events ?? []).filter((e) => new Date(e.starts_at).getTime() <= today.getTime());
  const doneEvents = pastEvents.filter((e) => e.completed_at != null).length;
  const caloriesThis = avg(
    Object.values(
      (foods ?? []).filter((f) => inWeek(f.date)).reduce<Record<string, number>>((acc, f) => {
        acc[f.date] = (acc[f.date] ?? 0) + (f.calories ?? 0);
        return acc;
      }, {})
    )
  );

  // Top insight across the full window.
  const feelingByDay = new Map((feelings ?? []).map((f) => [f.date, f]));
  const foodByDay = (foods ?? []).reduce<Record<string, { c: number; p: number }>>((acc, f) => {
    const a = acc[f.date] ?? { c: 0, p: 0 };
    a.c += f.calories ?? 0; a.p += f.protein_g ?? 0; acc[f.date] = a; return acc;
  }, {});
  const habitCountByDay = new Map<string, number>();
  // habitLogs only covers this week; for insights we'd want more, but week is fine for a teaser.
  const records: DailyRecord[] = m.map((d) => {
    const feel = feelingByDay.get(d.date);
    const food = foodByDay[d.date];
    return {
      date: d.date, readiness: d.readiness_score, sleep_score: d.sleep_score, hrv: d.hrv_avg, resting_hr: d.resting_hr, steps: d.steps,
      mood: feel?.mood ?? null, energy: feel?.energy ?? null, stress: feel?.stress ?? null, soreness: feel?.soreness ?? null,
      calories: food?.c ?? null, protein: food?.p ?? null, habitsDone: habitCountByDay.get(d.date) ?? null,
    };
  });
  const topInsight = computeInsights(records, 1)[0] ?? null;

  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] || "there";
  const html = renderDigest({ firstName, readinessThis, readinessPrev, sleepThis, stepsThis, habitsDone, doneEvents, pastEvents: pastEvents.length, caloriesThis, topInsight: topInsight ? { headline: topInsight.headline, detail: topInsight.detail } : null });

  const sent = await sendEmail({
    to: email,
    subject: `Your week in review${firstName !== "there" ? `, ${firstName}` : ""}`,
    html,
    text: `Your week in review. Readiness avg ${readinessThis != null ? Math.round(readinessThis) : "—"}. Open Daybreak: ${publicEnv.NEXT_PUBLIC_APP_URL}/health`,
  });
  if (sent) await audit(userId, "digest.sent");
  return sent;
}

interface DigestData {
  firstName: string;
  readinessThis: number | null;
  readinessPrev: number | null;
  sleepThis: number | null;
  stepsThis: number | null;
  habitsDone: number;
  doneEvents: number;
  pastEvents: number;
  caloriesThis: number | null;
  topInsight: { headline: string; detail: string } | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderDigest(d: DigestData): string {
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const delta = d.readinessThis != null && d.readinessPrev != null ? Math.round(d.readinessThis - d.readinessPrev) : null;
  const deltaStr = delta != null ? (delta > 0 ? `▲ ${delta} vs last week` : delta < 0 ? `▼ ${-delta} vs last week` : "level with last week") : "";
  const stat = (label: string, value: string, sub = "") => `
    <td style="padding:10px 8px;text-align:center;">
      <div style="font-size:24px;font-weight:600;color:#5a3d1a;">${value}</div>
      <div style="font-size:12px;color:#9a6b1f;">${label}</div>
      ${sub ? `<div style="font-size:11px;color:#a8957c;">${sub}</div>` : ""}
    </td>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fdf8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr><td style="padding:0 24px 16px;"><p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#c8901f;">☀ Daybreak · Week in review</p></td></tr>
      <tr><td style="padding:0 24px;">
        <div style="background:linear-gradient(135deg,#fff4dd,#ffe9c7);border-radius:20px;padding:20px 12px;">
          <table role="presentation" width="100%"><tr>
            ${stat("avg readiness", d.readinessThis != null ? String(Math.round(d.readinessThis)) : "—", deltaStr)}
            ${stat("avg sleep", d.sleepThis != null ? String(Math.round(d.sleepThis)) : "—")}
            ${stat("habits done", String(d.habitsDone))}
            ${stat("plan stuck to", d.pastEvents > 0 ? `${Math.round((d.doneEvents / d.pastEvents) * 100)}%` : "—")}
          </tr></table>
        </div>
      </td></tr>
      ${
        d.topInsight
          ? `<tr><td style="padding:20px 24px 0;">
               <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9a6b1f;">Pattern of the week</p>
               <div style="padding:14px 16px;background:#fff;border:1px solid #f0e6d6;border-radius:12px;">
                 <p style="margin:0 0 4px;font-weight:600;color:#5a3d1a;">${escapeHtml(d.topInsight.headline)}</p>
                 <p style="margin:0;font-size:14px;line-height:1.5;color:#6b5840;">${escapeHtml(d.topInsight.detail)}</p>
               </div>
             </td></tr>`
          : ""
      }
      ${
        d.caloriesThis != null
          ? `<tr><td style="padding:16px 24px 0;"><p style="margin:0;font-size:14px;color:#6b5840;">You averaged about <strong>${Math.round(d.caloriesThis)}</strong> calories a day this week${d.stepsThis != null ? ` and <strong>${Math.round(d.stepsThis).toLocaleString()}</strong> steps` : ""}.</p></td></tr>`
          : ""
      }
      <tr><td style="padding:28px 24px;" align="center"><a href="${appUrl}/health" style="display:inline-block;background:#e8a317;color:#3a2606;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">See your full week</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
