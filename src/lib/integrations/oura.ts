import "server-only";
import { serverEnv, publicEnv } from "@/env";
import { getValidAccessToken, type TokenSet } from "@/lib/integrations/tokens";

/** Oura API v2 (OAuth2). https://cloud.ouraring.com/v2/docs */

const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API_BASE = "https://api.ouraring.com/v2";

export const OURA_REDIRECT_PATH = "/api/oauth/oura/callback";
const SCOPES = "daily heartrate personal";

export function ouraAuthorizeUrl(state: string): string {
  const env = serverEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.OURA_CLIENT_ID ?? "",
    redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${OURA_REDIRECT_PATH}`,
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeOuraCode(code: string): Promise<TokenSet> {
  const env = serverEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${OURA_REDIRECT_PATH}`,
      client_id: env.OURA_CLIENT_ID ?? "",
      client_secret: env.OURA_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) throw new Error(`Oura token exchange failed (${res.status})`);

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  };
}

interface OuraCollectionResponse<T> {
  data: T[];
  next_token: string | null;
}

interface OuraDailyReadiness {
  day: string;
  score: number | null;
  contributors?: { activity_balance?: number | null };
  temperature_deviation?: number | null;
}

interface OuraDailySleep {
  day: string;
  score: number | null;
}

interface OuraSleepPeriod {
  day: string;
  type: string;
  average_hrv: number | null;
  average_heart_rate: number | null;
  lowest_heart_rate: number | null;
  total_sleep_duration: number | null; // seconds
  deep_sleep_duration: number | null;
  rem_sleep_duration: number | null;
  light_sleep_duration: number | null;
  efficiency: number | null;
}

async function ouraGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | null = null;

  do {
    const search = new URLSearchParams(params);
    if (nextToken) search.set("next_token", nextToken);
    const res = await fetch(`${API_BASE}${path}?${search}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Oura API ${path} failed (${res.status})`);
    const json = (await res.json()) as OuraCollectionResponse<T>;
    results.push(...json.data);
    nextToken = json.next_token;
  } while (nextToken);

  return results;
}

export interface DailyMetrics {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_duration_min: number | null;
  sleep_efficiency: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  light_sleep_min: number | null;
  activity_balance: number | null;
  body_temperature_delta: number | null;
}

/**
 * Fetch and merge Oura readiness + sleep data for a date range into one
 * row per day, ready for upsert into health_metrics.
 */
export async function fetchOuraDailyMetrics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyMetrics[] | null> {
  const accessToken = await getValidAccessToken(userId, "oura");
  if (!accessToken) return null;

  const range = { start_date: startDate, end_date: endDate };
  const [readiness, dailySleep, sleepPeriods] = await Promise.all([
    ouraGet<OuraDailyReadiness>(accessToken, "/usercollection/daily_readiness", range),
    ouraGet<OuraDailySleep>(accessToken, "/usercollection/daily_sleep", range),
    ouraGet<OuraSleepPeriod>(accessToken, "/usercollection/sleep", range),
  ]);

  const byDay = new Map<string, DailyMetrics>();
  const day = (date: string): DailyMetrics => {
    let row = byDay.get(date);
    if (!row) {
      row = {
        date,
        readiness_score: null,
        sleep_score: null,
        hrv_avg: null,
        resting_hr: null,
        sleep_duration_min: null,
        sleep_efficiency: null,
        deep_sleep_min: null,
        rem_sleep_min: null,
        light_sleep_min: null,
        activity_balance: null,
        body_temperature_delta: null,
      };
      byDay.set(date, row);
    }
    return row;
  };

  for (const r of readiness) {
    const row = day(r.day);
    row.readiness_score = r.score;
    row.activity_balance = r.contributors?.activity_balance ?? null;
    row.body_temperature_delta = r.temperature_deviation ?? null;
  }

  for (const s of dailySleep) {
    day(s.day).sleep_score = s.score;
  }

  for (const p of sleepPeriods) {
    if (p.type !== "long_sleep") continue;
    const row = day(p.day);
    row.hrv_avg = p.average_hrv;
    row.resting_hr = p.lowest_heart_rate ?? p.average_heart_rate;
    row.sleep_duration_min = p.total_sleep_duration ? Math.round(p.total_sleep_duration / 60) : null;
    row.sleep_efficiency = p.efficiency;
    row.deep_sleep_min = p.deep_sleep_duration ? Math.round(p.deep_sleep_duration / 60) : null;
    row.rem_sleep_min = p.rem_sleep_duration ? Math.round(p.rem_sleep_duration / 60) : null;
    row.light_sleep_min = p.light_sleep_duration ? Math.round(p.light_sleep_duration / 60) : null;
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
