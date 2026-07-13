/**
 * AI data-use consent. Daybreak can send a source-aware health summary, the
 * manual check-in, and busy calendar context to an AI processor (OpenAI) to
 * write the morning briefing and daily plan. These per-user toggles let people
 * opt out of each context; when a context is off the server OMITS it from the
 * payload entirely (or, for calendar, keeps the busy time-block but strips the
 * title). Pure helpers so the gating is identical and unit-testable everywhere.
 */

export interface AiConsent {
  health: boolean;
  calendar: boolean;
  checkin: boolean;
}

export const AI_CONSENT_VERSION = "2026-07-13";
export const DEFAULT_AI_CONSENT: AiConsent = { health: false, calendar: false, checkin: false };

export interface AiConsentPreferences {
  allow_ai_health_context?: boolean | null;
  allow_ai_calendar_context?: boolean | null;
  allow_ai_checkin_context?: boolean | null;
  ai_consent_version?: string | null;
  ai_consent_updated_at?: string | null;
}

/** Read consent from a user_preferences row; only explicit true grants access. */
export function aiConsentFromPrefs(prefs: AiConsentPreferences | null | undefined): AiConsent {
  return {
    health: prefs?.allow_ai_health_context === true,
    calendar: prefs?.allow_ai_calendar_context === true,
    checkin: prefs?.allow_ai_checkin_context === true,
  };
}

/** A recorded decision is required before any external AI processor is used. */
export function hasCurrentAiConsentDecision(
  prefs: AiConsentPreferences | null | undefined
): boolean {
  return (
    prefs?.ai_consent_version === AI_CONSENT_VERSION &&
    typeof prefs.ai_consent_updated_at === "string" &&
    prefs.ai_consent_updated_at.length > 0
  );
}

/** Return the value only when allowed, otherwise null (drops health/check-in context). */
export function gateContext<T>(value: T, allowed: boolean): T | null {
  return allowed ? value : null;
}

/** Replace a calendar event title with a generic label when calendar context is off. */
export function redactEventTitle(title: string, allowCalendar: boolean): string {
  return allowCalendar ? title : "Busy time";
}
