import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { signState, randomToken } from "@/lib/crypto";
import { ouraAuthorizeUrl } from "@/lib/integrations/oura";
import { googleAuthorizeUrl } from "@/lib/integrations/google-calendar";
import { integrationsAvailable, publicEnv } from "@/env";

const providerSchema = z.enum(["oura", "google"]);

/**
 * Begins an OAuth flow. The `state` parameter is an HMAC-signed value of
 * "<userId>:<nonce>", and the nonce is mirrored in an httpOnly cookie —
 * the callback requires both to match (CSRF protection).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/oauth/[provider]/start">) {
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

  if (!integrationsAvailable[provider]()) {
    return NextResponse.json(
      { error: `${provider} integration is not configured on this deployment` },
      { status: 503 }
    );
  }

  const limited = await rateLimit(`oauth:${user.id}`, RATE_LIMITS.oauth);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const nonce = randomToken(16);
  const state = signState(`${user.id}:${nonce}`);

  const authorizeUrl = provider === "oura" ? ouraAuthorizeUrl(state) : googleAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`oauth_nonce_${provider}`, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/oauth",
  });
  return response;
}
