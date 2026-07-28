import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/env";
import { sendEmail } from "@/lib/integrations/email";
import { sendPushToUser } from "@/lib/push";
import { audit } from "@/lib/audit";
import { isUserEligible } from "@/lib/account-eligibility";
import { safeLog } from "@/lib/security/safe-logger";

/**
 * Notifications intentionally disclose no plan, calendar, health, check-in, or
 * AI-generated content. They only tell the user that content is ready inside
 * the authenticated app.
 */
export const MORNING_NOTIFICATION = Object.freeze({
  title: "Your Daybreak plan is ready",
  body: "Open Daybreak to review today's plan.",
  subject: "Your Daybreak plan is ready",
});

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface NotificationSettingsRow {
  morning_email_enabled: boolean;
  last_morning_email_sent_at: string | null;
  unsubscribe_token: string;
}

async function ensureSettings(userId: string): Promise<NotificationSettingsRow | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("notification_settings")
    .select("morning_email_enabled, last_morning_email_sent_at, unsubscribe_token")
    .eq("user_id", userId)
    .maybeSingle<NotificationSettingsRow>();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("notification_settings")
    .insert({ user_id: userId })
    .select("morning_email_enabled, last_morning_email_sent_at, unsubscribe_token")
    .single<NotificationSettingsRow>();
  if (error) {
    safeLog("error", "notifications.settings_create_failed", {
      errorClass: error.code ?? "database_error",
    });
    return null;
  }
  return created;
}

export async function sendMorningEmailForUser(userId: string): Promise<boolean> {
  if (!(await isUserEligible(userId))) return false;
  const admin = createAdminClient();
  const todayStr = isoDate(new Date());
  const settings = await ensureSettings(userId);
  if (!settings || !settings.morning_email_enabled) return false;
  if (
    settings.last_morning_email_sent_at &&
    isoDate(new Date(settings.last_morning_email_sent_at)) === todayStr
  ) {
    return false;
  }

  const [{ data: summary }, { data: userData }] = await Promise.all([
    admin
      .from("daily_summaries")
      .select("id")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle<{ id: string }>(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (!summary) return false;
  const email = userData?.user?.email;
  if (!email) return false;

  const unsubscribeUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/api/notifications/unsubscribe?token=${settings.unsubscribe_token}`;
  const sent = await sendEmail({
    to: email,
    subject: MORNING_NOTIFICATION.subject,
    html: renderMorningEmail(unsubscribeUrl),
    text: renderMorningText(unsubscribeUrl),
    unsubscribeUrl,
  });
  if (!sent) return false;

  await admin
    .from("notification_settings")
    .update({ last_morning_email_sent_at: new Date().toISOString() })
    .eq("user_id", userId);
  await audit(userId, "notification.morning_email_sent");
  return true;
}

export async function sendMorningPushForUser(userId: string): Promise<number> {
  if (!(await isUserEligible(userId))) return 0;
  const admin = createAdminClient();
  const { data: summary } = await admin
    .from("daily_summaries")
    .select("id")
    .eq("user_id", userId)
    .eq("date", isoDate(new Date()))
    .maybeSingle<{ id: string }>();
  if (!summary) return 0;

  return sendPushToUser(userId, {
    title: MORNING_NOTIFICATION.title,
    body: MORNING_NOTIFICATION.body,
    url: "/dashboard",
  });
}

export function renderMorningEmail(unsubscribeUrl: string): string {
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#fdf8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5a3d1a">
  <main style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">
    <p style="font-weight:700;color:#9a6b1f">Daybreak</p>
    <h1 style="font-size:22px">${MORNING_NOTIFICATION.title}</h1>
    <p>${MORNING_NOTIFICATION.body}</p>
    <p><a href="${appUrl}/dashboard">Open Daybreak</a></p>
    <p style="font-size:12px;color:#806f5b">Morning notifications are enabled for your account. <a href="${unsubscribeUrl}">Turn these off</a>.</p>
  </main>
</body></html>`;
}

export function renderMorningText(unsubscribeUrl: string): string {
  return [
    MORNING_NOTIFICATION.title,
    "",
    MORNING_NOTIFICATION.body,
    `Open Daybreak: ${publicEnv.NEXT_PUBLIC_APP_URL}/dashboard`,
    "",
    `Turn these off: ${unsubscribeUrl}`,
  ].join("\n");
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_settings")
    .update({ morning_email_enabled: false })
    .eq("unsubscribe_token", token)
    .select("user_id")
    .maybeSingle<{ user_id: string }>();
  if (error || !data) return false;
  await audit(data.user_id, "notification.unsubscribed", {
    metadata: { channel: "morning_email" },
  });
  return true;
}
