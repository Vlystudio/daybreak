import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { verifyState } from "@/lib/crypto";
import { saveConnection } from "@/lib/integrations/tokens";
import { exchangeOuraCode } from "@/lib/integrations/oura";
import { exchangeGoogleCode } from "@/lib/integrations/google-calendar";
import { syncOuraForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import { audit } from "@/lib/audit";
import { publicEnv } from "@/env";

const providerSchema = z.enum(["oura", "google"]);

function dashboardRedirect(params: Record<string, string>) {
  const url = new URL("/dashboard", publicEnv.NEXT_PUBLIC_APP_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/oauth/[provider]/callback">
) {
  const { provider: rawProvider } = await ctx.params;
  const parsed = providerSchema.safeParse(rawProvider);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const provider = parsed.data;

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", publicEnv.NEXT_PUBLIC_APP_URL));
  }

  const searchParams = request.nextUrl.searchParams;
  if (searchParams.get("error")) {
    return dashboardRedirect({ connect_error: "denied" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const nonceCookie = request.cookies.get(`oauth_nonce_${provider}`)?.value;

  // CSRF check: state must verify against our HMAC, belong to the signed-in
  // user, and carry the nonce we set when the flow started.
  const statePayload = state ? verifyState(state) : null;
  const [stateUserId, stateNonce] = statePayload?.split(":") ?? [];
  if (!code || !statePayload || stateUserId !== user.id || !nonceCookie || stateNonce !== nonceCookie) {
    return dashboardRedirect({ connect_error: "invalid_state" });
  }

  try {
    const tokens = provider === "oura" ? await exchangeOuraCode(code) : await exchangeGoogleCode(code);
    await saveConnection(user.id, provider, tokens);
    await audit(user.id, "connection.linked", { entity: "oauth_connection", metadata: { provider } });

    // Kick off an initial sync so the dashboard is populated immediately.
    try {
      if (provider === "oura") {
        await syncOuraForUser(user.id, 14);
        await generateSummaryForUser(user.id);
      } else {
        await syncCalendarForUser(user.id);
      }
    } catch (err) {
      console.error(`[oauth] initial ${provider} sync failed:`, err);
    }

    const response = dashboardRedirect({ connected: provider });
    response.cookies.delete(`oauth_nonce_${provider}`);
    return response;
  } catch (err) {
    console.error(`[oauth] ${provider} connection failed:`, err);
    return dashboardRedirect({ connect_error: "exchange_failed" });
  }
}
