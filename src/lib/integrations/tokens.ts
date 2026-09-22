import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { serverEnv } from "@/env";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { assertProcessorEnabled } from "@/lib/privacy/processors";

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

export type ProviderRevocationStatus = "revoked" | "already_invalid";

export interface ProviderRevocationResult {
  provider: Provider;
  status: ProviderRevocationStatus;
  httpStatus: number;
}

export class ProviderRevocationRetryableError extends Error {
  constructor(
    public readonly provider: Provider,
    public readonly code: "network" | "rate_limited" | "provider_unavailable" | "provider_rejected"
  ) {
    super(`${provider} authorization revocation is temporarily unavailable`);
    this.name = "ProviderRevocationRetryableError";
  }
}

/**
 * Revoke a stored provider grant without ever exposing a decrypted token to
 * the browser or logs. A missing connection is idempotently already-invalid.
 * Only network/429/5xx outcomes are retryable; callers may safely delete the
 * local credential after any returned terminal result.
 */
export async function revokeProviderConnection(
  userId: string,
  provider: Provider
): Promise<ProviderRevocationResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_connections")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle<StoredConnection>();

  if (error) throw new ProviderRevocationRetryableError(provider, "provider_unavailable");
  if (!data) return { provider, status: "already_invalid", httpStatus: 204 };

  const accessToken = decryptToken(data.access_token_enc);
  const refreshToken = data.refresh_token_enc ? decryptToken(data.refresh_token_enc) : null;
  let url: string;
  let headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  let body: URLSearchParams | undefined;

  if (provider === "google") {
    url = "https://oauth2.googleapis.com/revoke";
    body = new URLSearchParams({ token: refreshToken ?? accessToken });
  } else if (provider === "fitbit") {
    url = "https://api.fitbit.com/oauth2/revoke";
    headers = { ...headers, Authorization: `Bearer ${accessToken}` };
    body = new URLSearchParams({ token: refreshToken ?? accessToken });
  } else {
    // Oura's current documentation defines access_token as a URL parameter.
    url = `https://api.ouraring.com/oauth/revoke?${new URLSearchParams({ access_token: accessToken })}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body, redirect: "error" });
  } catch {
    throw new ProviderRevocationRetryableError(provider, "network");
  }

  if (response.ok) return { provider, status: "revoked", httpStatus: response.status };
  if (response.status === 429) {
    throw new ProviderRevocationRetryableError(provider, "rate_limited");
  }
  if (response.status >= 500) {
    throw new ProviderRevocationRetryableError(provider, "provider_unavailable");
  }

  // These endpoints document 400/401 for an already-invalid credential. Any
  // other rejection does not prove that the remote grant is gone, so preserve
  // the encrypted local credential and keep deletion/disconnect fail-closed.
  if (response.status === 400 || response.status === 401) {
    return { provider, status: "already_invalid", httpStatus: response.status };
  }
  throw new ProviderRevocationRetryableError(provider, "provider_rejected");
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
  assertProcessorEnabled(provider);
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
  if (!refreshed.ok) {
    // Only drop the connection when the provider DEFINITIVELY rejected the
    // refresh token (revoked/invalid). A transient outage (5xx/429/network)
    // leaves it in place so the next sync can try again, instead of silently
    // unlinking the user's wearable over a momentary blip.
    if (refreshed.permanent) await deleteConnection(userId, provider);
    return null;
  }

  await saveConnection(userId, provider, refreshed.tokens);
  return refreshed.tokens.accessToken;
}

const TOKEN_ENDPOINTS: Record<Provider, string> = {
  oura: "https://api.ouraring.com/oauth/token",
  google: "https://oauth2.googleapis.com/token",
  fitbit: "https://api.fitbit.com/oauth2/token",
};

/** Refresh outcome: a token set, or a failure tagged permanent (revoked →
 *  drop the connection) vs. transient (provider blip → keep and retry later). */
type RefreshResult = { ok: true; tokens: TokenSet } | { ok: false; permanent: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshTokens(provider: Provider, refreshToken: string): Promise<RefreshResult> {
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
    body.set(
      "client_secret",
      (provider === "oura" ? env.OURA_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET) ?? ""
    );
  }

  // Retry transient failures (network error, 5xx, 429, 408) with a short
  // backoff. A 4xx auth rejection is treated as permanent (the refresh token
  // was revoked/invalidated) and returns immediately.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(TOKEN_ENDPOINTS[provider], {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      safeLog("error", "oauth.refresh_network_error", {
        provider,
        attempt,
        errorClass: errorClass(err),
      });
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt);
        continue;
      }
      return { ok: false, permanent: false };
    }

    if (res.ok) {
      const json = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };
      return {
        ok: true,
        tokens: {
          accessToken: json.access_token,
          // Google does not return a new refresh token on refresh; keep the old one.
          refreshToken: json.refresh_token ?? refreshToken,
          expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
          scope: json.scope ?? null,
        },
      };
    }

    const transient = res.status >= 500 || res.status === 429 || res.status === 408;
    safeLog("warn", "oauth.refresh_rejected", { provider, httpStatus: res.status });
    if (transient && attempt < MAX_ATTEMPTS) {
      await sleep(500 * attempt);
      continue;
    }
    return { ok: false, permanent: !transient };
  }

  return { ok: false, permanent: false };
}
