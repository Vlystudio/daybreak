import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, isAuthenticatedUserEligible } from "@/lib/auth";
import { verifyState } from "@/lib/crypto";
import { saveConnection } from "@/lib/integrations/tokens";
import { OAUTH_PROVIDERS, OAUTH_PROVIDER_NAMES } from "@/lib/integrations/oauth-providers";
import { syncWearableForUser, syncCalendarForUser, generateSummaryForUser } from "@/lib/sync";
import { audit } from "@/lib/audit";
import { publicEnv } from "@/env";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

const providerSchema = z.enum(OAUTH_PROVIDER_NAMES);

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
  if (!(await isAuthenticatedUserEligible(user.id))) {
    return NextResponse.redirect(new URL("/eligibility", publicEnv.NEXT_PUBLIC_APP_URL));
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
  if (
    !code ||
    !statePayload ||
    stateUserId !== user.id ||
    !nonceCookie ||
    stateNonce !== nonceCookie
  ) {
    return dashboardRedirect({ connect_error: "invalid_state" });
  }

  try {
    const config = OAUTH_PROVIDERS[provider];
    const tokens = await config.exchangeCode(code);
    await saveConnection(user.id, provider, tokens);
    await audit(user.id, "connection.linked", {
      entity: "oauth_connection",
      metadata: { provider },
    });

    // Kick off an initial sync so the dashboard is populated immediately.
    try {
      if (config.kind === "wearable") {
        await syncWearableForUser(user.id, provider, 14);
        await generateSummaryForUser(user.id);
      } else {
        await syncCalendarForUser(user.id);
      }
    } catch (err) {
      safeLog("error", "oauth.initial_sync_failed", { provider, errorClass: errorClass(err) });
    }

    const response = dashboardRedirect({ connected: provider });
    response.cookies.delete(`oauth_nonce_${provider}`);
    return response;
  } catch (err) {
    safeLog("error", "oauth.connection_failed", { provider, errorClass: errorClass(err) });
    return dashboardRedirect({ connect_error: "exchange_failed" });
  }
}
