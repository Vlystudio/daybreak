import "server-only";
import { serverEnv, publicEnv } from "@/env";
import { getValidAccessToken, type TokenSet } from "@/lib/integrations/tokens";
import { safeLog } from "@/lib/security/safe-logger";
import { assertProcessorEnabled } from "@/lib/privacy/processors";

/** Google Calendar API v3 (OAuth2). Full calendar scope so we can both read the
 *  user's events and create/manage a dedicated "Daybreak" calendar for export. */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_REDIRECT_PATH = "/api/oauth/google/callback";
const SCOPES = "https://www.googleapis.com/auth/calendar";

function googleFetch(input: string, init: RequestInit = {}): Promise<Response> {
  assertProcessorEnabled("google");
  return fetch(input, {
    ...init,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
}

/** True if a granted scope string allows writing events (not just read-only). */
export function scopeAllowsWrite(scope: string | null | undefined): boolean {
  const s = scope ?? "";
  return (
    /https:\/\/www\.googleapis\.com\/auth\/calendar(?![.\w])/.test(s) ||
    s.includes("auth/calendar.events")
  );
}

export function googleAuthorizeUrl(state: string): string {
  assertProcessorEnabled("google");
  const env = serverEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${GOOGLE_REDIRECT_PATH}`,
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<TokenSet> {
  const env = serverEnv();
  const res = await googleFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${publicEnv.NEXT_PUBLIC_APP_URL}${GOOGLE_REDIRECT_PATH}`,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);

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

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Fetch events from the user's calendar within a time window.
 * Returns null when the user has no Google connection.
 */
export async function fetchGoogleEvents(
  userId: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[] | null> {
  const accessToken = await getValidAccessToken(userId, "google");
  if (!accessToken) return null;

  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await googleFetch(
      `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Google Calendar API failed (${res.status})`);

    const json = (await res.json()) as { items?: GoogleCalendarEvent[]; nextPageToken?: string };
    events.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  return events.filter((e) => e.status !== "cancelled");
}

// ── Export: write Daybreak's plan into a dedicated Google calendar ────────────

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  daybreakId: string;
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

function eventBody(e: GoogleEventInput) {
  return {
    summary: e.summary,
    description: e.description,
    location: e.location,
    start: e.start,
    end: e.end,
    extendedProperties: { private: { daybreakId: e.daybreakId } },
  };
}

/** Create the dedicated "Daybreak" calendar; returns its id (or null on failure). */
export async function createDaybreakCalendar(accessToken: string): Promise<string | null> {
  const res = await googleFetch(`${API_BASE}/calendars`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      summary: "Daybreak",
      description: "Your Daybreak plan — meals, workouts, chores and focus blocks.",
    }),
  });
  if (!res.ok) {
    safeLog("error", "google_calendar.create_calendar_failed", { status: res.status });
    return null;
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  e: GoogleEventInput
): Promise<string | null> {
  const res = await googleFetch(`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(eventBody(e)),
  });
  if (!res.ok) {
    safeLog("error", "google_calendar.insert_event_failed", { status: res.status });
    return null;
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

/** Update a mirrored event. Returns "ok" | "gone" (404/410) | "error". */
export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  e: GoogleEventInput
): Promise<"ok" | "gone" | "error"> {
  const res = await googleFetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", headers: authHeaders(accessToken), body: JSON.stringify(eventBody(e)) }
  );
  if (res.ok) return "ok";
  if (res.status === 404 || res.status === 410) return "gone";
  return "error";
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  const res = await googleFetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.ok || res.status === 410; // 410 = already gone
}

export interface ExportedGoogleEvent {
  id: string;
  daybreakId: string | null;
}

/** List events in the Daybreak calendar within a window, with our private id tag. */
export async function listDaybreakCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<ExportedGoogleEvent[]> {
  const out: ExportedGoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await googleFetch(
      `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return out;
    const json = (await res.json()) as {
      items?: { id: string; extendedProperties?: { private?: { daybreakId?: string } } }[];
      nextPageToken?: string;
    };
    for (const it of json.items ?? []) {
      out.push({ id: it.id, daybreakId: it.extendedProperties?.private?.daybreakId ?? null });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}
