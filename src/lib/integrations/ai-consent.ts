/** Pure AI consent vocabulary shared by the UI and the trusted egress gateway. */

export const AI_CONSENT_VERSION = "2026-07-28";
export const AI_CONSENT_TTL_DAYS = 180;

export interface AiConsent {
  basic: boolean;
  tasks: boolean;
  checkin: boolean;
  health: boolean;
  calendarAvailability: boolean;
  calendarDetail: boolean;
  profile: boolean;
  uploads: boolean;
}

export const DEFAULT_AI_CONSENT: AiConsent = {
  basic: false,
  tasks: false,
  checkin: false,
  health: false,
  calendarAvailability: false,
  calendarDetail: false,
  profile: false,
  uploads: false,
};

export const AI_CATEGORY_NAMES = [
  "basic",
  "tasks",
  "checkin",
  "health",
  "calendar_availability",
  "calendar_detail",
  "profile",
  "uploads",
] as const;
export type AiDataCategory = (typeof AI_CATEGORY_NAMES)[number];

export const AI_PURPOSES = [
  "morning_briefing",
  "daily_plan",
  "health_analysis",
  "health_checkin",
  "workout_plan",
  "fitness_plan",
  "meal_plan",
  "food_image",
  "receipt_image",
] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

export interface AiConsentPreferences {
  allow_ai_basic_processing?: boolean | null;
  allow_ai_tasks_context?: boolean | null;
  allow_ai_health_context?: boolean | null;
  allow_ai_calendar_availability?: boolean | null;
  allow_ai_calendar_detail?: boolean | null;
  allow_ai_checkin_context?: boolean | null;
  allow_ai_profile_context?: boolean | null;
  allow_ai_uploads?: boolean | null;
  ai_consent_version?: string | null;
  ai_consent_updated_at?: string | null;
  ai_consent_expires_at?: string | null;
}

/** Only literal true grants a category; calendar detail also needs availability. */
export function aiConsentFromPrefs(prefs: AiConsentPreferences | null | undefined): AiConsent {
  const calendarAvailability = prefs?.allow_ai_calendar_availability === true;
  return {
    basic: prefs?.allow_ai_basic_processing === true,
    tasks: prefs?.allow_ai_tasks_context === true,
    checkin: prefs?.allow_ai_checkin_context === true,
    health: prefs?.allow_ai_health_context === true,
    calendarAvailability,
    calendarDetail: calendarAvailability && prefs?.allow_ai_calendar_detail === true,
    profile: prefs?.allow_ai_profile_context === true,
    uploads: prefs?.allow_ai_uploads === true,
  };
}

/** A decision may decline everything; it is current when versioned and unexpired. */
export function hasCurrentAiConsentDecision(
  prefs: AiConsentPreferences | null | undefined,
  now = new Date()
): boolean {
  if (
    prefs?.ai_consent_version !== AI_CONSENT_VERSION ||
    typeof prefs.ai_consent_updated_at !== "string" ||
    typeof prefs.ai_consent_expires_at !== "string"
  ) {
    return false;
  }
  const expiresAt = Date.parse(prefs.ai_consent_expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function aiConsentCategories(consent: AiConsent): AiDataCategory[] {
  const categories: AiDataCategory[] = [];
  if (consent.basic) categories.push("basic");
  if (consent.tasks) categories.push("tasks");
  if (consent.checkin) categories.push("checkin");
  if (consent.health) categories.push("health");
  if (consent.calendarAvailability) categories.push("calendar_availability");
  if (consent.calendarDetail) categories.push("calendar_detail");
  if (consent.profile) categories.push("profile");
  if (consent.uploads) categories.push("uploads");
  return categories;
}

export function gateContext<T>(value: T, allowed: boolean): T | null {
  return allowed ? value : null;
}

export function redactEventTitle(title: string, allowDetail: boolean): string {
  return allowDetail ? title : "Busy time";
}
