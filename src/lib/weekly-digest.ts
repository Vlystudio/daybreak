import "server-only";
import { isUserEligible } from "@/lib/account-eligibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/env";
import { sendEmail } from "@/lib/integrations/email";
import { audit } from "@/lib/audit";

/**
 * Like every remote notification, the weekly email is deliberately neutral.
 * No health values, check-ins, nutrition, calendar details, derived insights,
 * AI text, names, or completion statistics leave the authenticated app.
 */
export const WEEKLY_NOTIFICATION = Object.freeze({
  subject: "Your Daybreak week is ready to review",
  body: "Open Daybreak to review your week and plan what comes next.",
});

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function renderWeeklyDigest(): { html: string; text: string } {
  const url = `${publicEnv.NEXT_PUBLIC_APP_URL}/dashboard`;
  return {
    html: `<!doctype html><html lang="en"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fdf8f0;padding:24px;color:#5a3d1a"><main style="max-width:560px;margin:auto;background:#fff;border-radius:20px;padding:28px"><p style="font-weight:700;color:#9a6b1f">Daybreak</p><h1 style="font-size:22px">${WEEKLY_NOTIFICATION.subject}</h1><p>${WEEKLY_NOTIFICATION.body}</p><p><a href="${url}">Open Daybreak</a></p></main></body></html>`,
    text: `${WEEKLY_NOTIFICATION.subject}\n\n${WEEKLY_NOTIFICATION.body}\n${url}`,
  };
}

export async function sendWeeklyDigestForUser(userId: string): Promise<boolean> {
  if (!(await isUserEligible(userId))) return false;
  const admin = createAdminClient();
  const weekAgo = isoDate(new Date(Date.now() - 7 * 86_400_000));
  const [{ data: settings }, { data: activity }, { data: userData }] = await Promise.all([
    admin
      .from("notification_settings")
      .select("morning_email_enabled")
      .eq("user_id", userId)
      .maybeSingle<{ morning_email_enabled: boolean }>(),
    admin
      .from("schedule_events")
      .select("id")
      .eq("user_id", userId)
      .gte("starts_at", `${weekAgo}T00:00:00.000Z`)
      .limit(1)
      .maybeSingle<{ id: string }>(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (settings && !settings.morning_email_enabled) return false;
  if (!activity || !userData?.user?.email) return false;
  const content = renderWeeklyDigest();
  const sent = await sendEmail({
    to: userData.user.email,
    subject: WEEKLY_NOTIFICATION.subject,
    ...content,
  });
  if (sent) await audit(userId, "digest.sent");
  return sent;
}
