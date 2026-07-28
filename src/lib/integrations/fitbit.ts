import "server-only";
import { serverEnv, publicEnv } from "@/env";
import { getValidAccessToken, type TokenSet } from "@/lib/integrations/tokens";
import type { DailyMetrics } from "@/lib/integrations/oura";
import { assertProcessorEnabled } from "@/lib/privacy/processors";

/**
 * Fitbit Web API (OAuth2). https://dev.fitbit.com/build/reference/web-api/
 * A second wearable behind the same health_metrics model as Oura. Fitbit uses
 * HTTP Basic auth (client_id:client_secret) on the token endpoint, and exposes
 * per-day endpoints rather than ranges, so we fan out one request set per day.
 */

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const API_BASE = "https://api.fitbit.com";

export const FITBIT_REDIRECT_PATH = "/api/oauth/fitbit/callback";
const SCOPES = "sleep heartrate activity profile";

function fitbitFetch(input: string, init: RequestInit = {}): Promise<Response> {
  assertProcessorEnabled("fitbit");
  return fetch(input, {
    ...init,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
}

function basicAuthHeader(): string {
  const env = serverEnv();
  const creds = `${env.FITBIT_CLIENT_ID ?? ""}:${env.FITBIT_CLIENT_SECRET ?? ""}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

export function fitbitAuthorizeUrl(state: string): string {
  assertProcessorEnabled("fitbit");
  const env = serverEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.FITBIT_CLIENT_ID ?? "",
    redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${FITBIT_REDIRECT_PATH}`,
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeFitbitCode(code: string): Promise<TokenSet> {
  const res = await fitbitFetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${FITBIT_REDIRECT_PATH}`,
    }),
  });

  if (!res.ok) throw new Error(`Fitbit token exchange failed (${res.status})`);

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    user_id?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
    providerUserId: json.user_id ?? null,
  };
}

/** Authorization header for the token-refresh path (used by tokens.ts). */
export function fitbitRefreshAuthHeader(): string {
  return basicAuthHeader();
}

async function fitbitGet<T>(accessToken: string, path: string): Promise<T | null> {
  try {
    const res = await fitbitFetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function eachDay(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

interface FitbitSleep {
  sleep?: {
    isMainSleep?: boolean;
    efficiency?: number;
    minutesAsleep?: number;
    levels?: { summary?: Record<string, { minutes?: number }> };
  }[];
}
interface FitbitHrv {
  hrv?: { value?: { dailyRmssd?: number } }[];
}
interface FitbitHeart {
  "activities-heart"?: { value?: { restingHeartRate?: number } }[];
}
interface FitbitActivity {
  summary?: { steps?: number; caloriesOut?: number; activityCalories?: number };
}

/** Fetch Fitbit data per day across the range, mapped into health_metrics rows. */
export async function fetchFitbitDailyMetrics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyMetrics[] | null> {
  const accessToken = await getValidAccessToken(userId, "fitbit");
  if (!accessToken) return null;

  const days = eachDay(startDate, endDate);
  const rows = await Promise.all(
    days.map(async (date): Promise<DailyMetrics | null> => {
      const [sleep, hrv, heart, activity] = await Promise.all([
        fitbitGet<FitbitSleep>(accessToken, `/1.2/user/-/sleep/date/${date}.json`),
        fitbitGet<FitbitHrv>(accessToken, `/1/user/-/hrv/date/${date}.json`),
        fitbitGet<FitbitHeart>(accessToken, `/1/user/-/activities/heart/date/${date}/1d.json`),
        fitbitGet<FitbitActivity>(accessToken, `/1/user/-/activities/date/${date}.json`),
      ]);

      const main = sleep?.sleep?.find((s) => s.isMainSleep) ?? sleep?.sleep?.[0];
      const stages = main?.levels?.summary ?? {};
      const restingHr = heart?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;
      const rmssd = hrv?.hrv?.[0]?.value?.dailyRmssd ?? null;
      const summary = activity?.summary;

      const hasAny =
        main != null || restingHr != null || rmssd != null || (summary?.steps ?? null) != null;
      if (!hasAny) return null;

      return {
        date,
        readiness_score: null, // Fitbit Daily Readiness is Premium-only; not exposed here.
        sleep_score: null, // Fitbit sleep score isn't in the standard Web API.
        hrv_avg: rmssd,
        resting_hr: restingHr,
        sleep_duration_min: main?.minutesAsleep ?? null,
        sleep_efficiency: main?.efficiency ?? null,
        deep_sleep_min: stages.deep?.minutes ?? null,
        rem_sleep_min: stages.rem?.minutes ?? null,
        light_sleep_min: stages.light?.minutes ?? null,
        activity_balance: null,
        body_temperature_delta: null,
        bedtime_start: null,
        bedtime_end: null,
        steps: summary?.steps ?? null,
        active_calories: summary?.activityCalories ?? null,
        total_calories: summary?.caloriesOut ?? null,
        activity_score: null,
        spo2_avg: null,
        respiratory_rate: null,
        stress_high_min: null,
        recovery_high_min: null,
        resilience_level: null,
      };
    })
  );

  return rows.filter((r): r is DailyMetrics => r !== null);
}
