import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/env";
import { sendEmail } from "@/lib/integrations/email";
import { sendPushToUser } from "@/lib/push";
import { audit } from "@/lib/audit";
import type { DailySummary } from "@/lib/types";

/**
 * Delivery of the daily morning briefing by email. Called from the morning cron
 * after the briefing is generated. Honors the user's opt-in, only sends once per
 * day, and includes a one-click unsubscribe link.
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface NotificationSettingsRow {
  morning_email_enabled: boolean;
  last_morning_email_sent_at: string | null;
  unsubscribe_token: string;
}

/** Read the user's notification settings, creating the row with defaults if absent. */
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
    console.error("[notifications] failed to create settings:", error.message);
    return null;
  }
  return created;
}

/**
 * Email today's briefing to the user if they're opted in and it hasn't already
 * gone out today. Returns true only when an email was actually sent.
 */
export async function sendMorningEmailForUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const todayStr = isoDate(new Date());

  const settings = await ensureSettings(userId);
  if (!settings || !settings.morning_email_enabled) return false;

  // Don't double-send if the cron re-runs the same day.
  if (settings.last_morning_email_sent_at && isoDate(new Date(settings.last_morning_email_sent_at)) === todayStr) {
    return false;
  }

  const [{ data: summary }, { data: profile }, { data: userData }] = await Promise.all([
    admin
      .from("daily_summaries")
      .select("date, summary, focus, insights, recommendations, generated_at")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle<DailySummary>(),
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle<{ display_name: string }>(),
    admin.auth.admin.getUserById(userId),
  ]);

  if (!summary) return false;
  const email = userData?.user?.email;
  if (!email) return false;

  const unsubscribeUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/api/notifications/unsubscribe?token=${settings.unsubscribe_token}`;
  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] || "there";

  const sent = await sendEmail({
    to: email,
    subject: `Good morning${firstName !== "there" ? `, ${firstName}` : ""} — your Daybreak briefing`,
    html: renderBriefingEmail(summary, unsubscribeUrl),
    text: renderBriefingText(summary, firstName, unsubscribeUrl),
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

/**
 * Push today's briefing to a user's devices. Subscribing is itself the opt-in,
 * so this isn't gated on the email preference. Returns the number delivered.
 */
export async function sendMorningPushForUser(userId: string): Promise<number> {
  const admin = createAdminClient();
  const todayStr = isoDate(new Date());

  const { data: summary } = await admin
    .from("daily_summaries")
    .select("summary, focus")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .maybeSingle<{ summary: string; focus: string | null }>();
  if (!summary) return 0;

  const body = (summary.focus?.trim() || summary.summary).slice(0, 160);
  return sendPushToUser(userId, { title: "☀ Your Daybreak briefing", body, url: "/dashboard" });
}

// ── email rendering ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBriefingEmail(summary: DailySummary, unsubscribeUrl: string): string {
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const insights = (summary.insights ?? [])
    .map(
      (i) =>
        `<li style="margin:0 0 8px;padding-left:4px;color:#5a4a33;font-size:15px;line-height:1.5;">${escapeHtml(i)}</li>`
    )
    .join("");
  const recommendations = (summary.recommendations ?? [])
    .map(
      (r) => `
        <div style="margin:0 0 12px;padding:14px 16px;background:#ffffff;border:1px solid #f0e6d6;border-radius:12px;">
          <p style="margin:0 0 4px;font-weight:600;font-size:15px;color:#9a6b1f;">${escapeHtml(r.title)}</p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#5a4a33;">${escapeHtml(r.body)}</p>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fdf8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
        <tr><td style="padding:0 24px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#c8901f;">☀ Daybreak</p>
        </td></tr>
        <tr><td style="padding:0 24px;">
          <div style="background:linear-gradient(135deg,#fff4dd,#ffe9c7);border-radius:20px;padding:28px 24px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9a6b1f;">Morning briefing</p>
            <p style="margin:0;font-size:19px;line-height:1.55;color:#5a3d1a;">${escapeHtml(summary.summary)}</p>
            ${
              summary.focus
                ? `<div style="margin:18px 0 0;padding:14px 16px;background:rgba(255,255,255,0.6);border-radius:12px;">
                     <p style="margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9a6b1f;">Today's focus</p>
                     <p style="margin:0;font-size:15px;line-height:1.5;color:#5a3d1a;">${escapeHtml(summary.focus)}</p>
                   </div>`
                : ""
            }
          </div>
        </td></tr>
        ${
          insights
            ? `<tr><td style="padding:24px 24px 0;">
                 <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9a6b1f;">Insights</p>
                 <ul style="margin:0;padding:0 0 0 18px;">${insights}</ul>
               </td></tr>`
            : ""
        }
        ${
          recommendations
            ? `<tr><td style="padding:24px 24px 0;">
                 <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9a6b1f;">Recommendations</p>
                 ${recommendations}
               </td></tr>`
            : ""
        }
        <tr><td style="padding:28px 24px;" align="center">
          <a href="${appUrl}/dashboard" style="display:inline-block;background:#e8a317;color:#3a2606;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">Open Daybreak</a>
        </td></tr>
        <tr><td style="padding:8px 24px 0;border-top:1px solid #f0e6d6;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a8957c;">
            You're getting this because morning briefings are on for your Daybreak account.
            <a href="${unsubscribeUrl}" style="color:#a8957c;text-decoration:underline;">Turn these off</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderBriefingText(summary: DailySummary, firstName: string, unsubscribeUrl: string): string {
  const lines = [`Good morning, ${firstName}.`, "", summary.summary];
  if (summary.focus) lines.push("", `Today's focus: ${summary.focus}`);
  if (summary.insights?.length) {
    lines.push("", "Insights:");
    for (const i of summary.insights) lines.push(`- ${i}`);
  }
  if (summary.recommendations?.length) {
    lines.push("", "Recommendations:");
    for (const r of summary.recommendations) lines.push(`- ${r.title}: ${r.body}`);
  }
  lines.push("", `Open Daybreak: ${publicEnv.NEXT_PUBLIC_APP_URL}/dashboard`, "", `Turn these off: ${unsubscribeUrl}`);
  return lines.join("\n");
}

/** Flip a user's morning-email preference off given their unsubscribe token. Returns true if a row matched. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_settings")
    .update({ morning_email_enabled: false })
    .eq("unsubscribe_token", token)
    .select("user_id")
    .maybeSingle<{ user_id: string }>();
  if (error || !data) return false;
  await audit(data.user_id, "notification.unsubscribed", { metadata: { channel: "morning_email" } });
  return true;
}
