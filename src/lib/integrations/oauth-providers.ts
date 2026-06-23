import "server-only";
import type { Provider, TokenSet } from "@/lib/integrations/tokens";
import { ouraAuthorizeUrl, exchangeOuraCode } from "@/lib/integrations/oura";
import { googleAuthorizeUrl, exchangeGoogleCode } from "@/lib/integrations/google-calendar";
import { fitbitAuthorizeUrl, exchangeFitbitCode } from "@/lib/integrations/fitbit";

/**
 * Registry of OAuth providers, so the start/callback routes stay provider-
 * agnostic. `kind` decides what initial sync runs after a successful connect:
 * wearables backfill health_metrics + regenerate the briefing; calendars sync
 * events. Adding a provider is: a module with authorize/exchange, an entry here,
 * env keys, and the DB provider constraint.
 */

export interface OAuthProviderConfig {
  kind: "wearable" | "calendar";
  authorizeUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<TokenSet>;
}

export const OAUTH_PROVIDERS: Record<Provider, OAuthProviderConfig> = {
  oura: { kind: "wearable", authorizeUrl: ouraAuthorizeUrl, exchangeCode: exchangeOuraCode },
  fitbit: { kind: "wearable", authorizeUrl: fitbitAuthorizeUrl, exchangeCode: exchangeFitbitCode },
  google: { kind: "calendar", authorizeUrl: googleAuthorizeUrl, exchangeCode: exchangeGoogleCode },
};

export const OAUTH_PROVIDER_NAMES = ["oura", "fitbit", "google"] as const;
