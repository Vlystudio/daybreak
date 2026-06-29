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

export const DEFAULT_AI_CONSENT: AiConsent = { health: true, calendar: true, checkin: true };

/** Read consent from a user_preferences row; missing values default to allow. */
export function aiConsentFromPrefs(
  prefs:
    | {
        allow_ai_health_context?: boolean | null;
        allow_ai_calendar_context?: boolean | null;
        allow_ai_checkin_context?: boolean | null;
      }
    | null
    | undefined
): AiConsent {
  return {
    health: prefs?.allow_ai_health_context ?? true,
    calendar: prefs?.allow_ai_calendar_context ?? true,
    checkin: prefs?.allow_ai_checkin_context ?? true,
  };
}

/** Return the value only when allowed, otherwise null (drops health/check-in context). */
export function gateContext<T>(value: T, allowed: boolean): T | null {
  return allowed ? value : null;
}

/** Replace a calendar event title with a generic label when calendar context is off. */
export function redactEventTitle(title: string, allowCalendar: boolean): string {
  return allowCalendar ? title : "Busy";
}
