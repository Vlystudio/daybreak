import { type NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/notifications";
import { publicEnv } from "@/env";

/**
 * One-click unsubscribe from the morning briefing email. The link in the email
 * footer hits GET (shows a confirmation page); inbox providers honoring
 * RFC 8058 one-click hit POST. Both flip `morning_email_enabled` off — no auth
 * required, since the token in the URL is the proof.
 */

function page(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#fdf8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:440px;margin:80px auto;padding:32px;background:#fff;border:1px solid #f0e6d6;border-radius:20px;text-align:center;">
<p style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#c8901f;margin:0 0 16px;">☀ Daybreak</p>
<h1 style="font-size:20px;color:#5a3d1a;margin:0 0 8px;">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#6b5840;margin:0 0 24px;">${body}</p>
<a href="${publicEnv.NEXT_PUBLIC_APP_URL}/settings" style="display:inline-block;background:#e8a317;color:#3a2606;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">Manage notifications</a>
</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return page("Invalid link", "This unsubscribe link is missing its token.");

  const ok = await unsubscribeByToken(token);
  return ok
    ? page("You're unsubscribed", "You won't get the morning briefing email anymore. You can turn it back on any time in settings.")
    : page("Link expired", "We couldn't match that unsubscribe link. You can manage email in settings.");
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await unsubscribeByToken(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
