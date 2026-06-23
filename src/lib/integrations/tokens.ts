import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { serverEnv } from "@/env";

/**
 * OAuth token storage. Tokens are AES-256-GCM encrypted at rest, the table
 * has no RLS policies (service-role only), and decrypted tokens never leave
 * the server.
 */

export type Provider = "oura" | "google" | "fitbit";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  providerUserId?: string | null;
}

export async function saveConnection(userId: string, provider: Provider, tokens: TokenSet) {
  const admin = createAdminClient();
  const { error } = await admin.from("oauth_connections").upsert(
    {
      user_id: userId,
      provider,
      access_token_enc: encryptToken(tokens.accessToken),
      refresh_token_enc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      expires_at: tokens.expiresAt?.toISOString() ?? null,
      scope: tokens.scope ?? null,
      provider_user_id: tokens.providerUserId ?? null,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(`Failed to store ${provider} connection: ${error.message}`);
}

export async function deleteConnection(userId: string, provider: Provider) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("oauth_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(`Failed to remove ${provider} connection: ${error.message}`);
}

interface StoredConnection {
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
}

/**
 * Returns a currently-valid access token for the user/provider, refreshing
 * via the provider's refresh endpoint when expired. Returns null when the
 * user has no connection (or the refresh token was revoked).
 */
export async function getValidAccessToken(
  userId: string,
  provider: Provider
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_connections")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle<StoredConnection>();

  if (error || !data) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const isExpired = expiresAt !== null && expiresAt.getTime() < Date.now() + 60_000;

  if (!isExpired) return decryptToken(data.access_token_enc);

  if (!data.refresh_token_enc) return null;

  const refreshed = await refreshTokens(provider, decryptToken(data.refresh_token_enc));
  if (!refreshed) {
    // Refresh token revoked or invalid — drop the dead connection.
    await deleteConnection(userId, provider);
    return null;
  }

  await saveConnection(userId, provider, refreshed);
  return refreshed.accessToken;
}

const TOKEN_ENDPOINTS: Record<Provider, string> = {
  oura: "https://api.ouraring.com/oauth/token",
  google: "https://oauth2.googleapis.com/token",
  fitbit: "https://api.fitbit.com/oauth2/token",
};

async function refreshTokens(provider: Provider, refreshToken: string): Promise<TokenSet | null> {
  const env = serverEnv();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  if (provider === "fitbit") {
    // Fitbit authenticates the token endpoint with HTTP Basic, not body params.
    const creds = `${env.FITBIT_CLIENT_ID ?? ""}:${env.FITBIT_CLIENT_SECRET ?? ""}`;
    headers.Authorization = `Basic ${Buffer.from(creds).toString("base64")}`;
  } else {
    body.set("client_id", (provider === "oura" ? env.OURA_CLIENT_ID : env.GOOGLE_CLIENT_ID) ?? "");
    body.set("client_secret", (provider === "oura" ? env.OURA_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET) ?? "");
  }

  const res = await fetch(TOKEN_ENDPOINTS[provider], { method: "POST", headers, body });

  if (!res.ok) {
    console.error(`[oauth] ${provider} token refresh failed with status ${res.status}`);
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: json.access_token,
    // Google does not return a new refresh token on refresh; keep the old one.
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  };
}
