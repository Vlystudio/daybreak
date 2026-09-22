/**
 * App feature flags. Flip a flag here to show or hide a whole feature across the
 * UI without deleting any code.
 *
 * NEST_ENABLED gates the "Nest" bird game end to end — the nav tab, the /nest
 * routes, the dashboard Nest card, the profile companion, the seeds currency,
 * and the bird/seed achievements. It is OFF for now; set it back to `true` to
 * restore the entire feature instantly. All the underlying code stays in place.
 *
 * Typed as `boolean` (not the literal `false`) on purpose: it keeps TypeScript
 * from treating the disabled branches as dead code or flagging the
 * now-conditional imports (e.g. the `Bird` icon) as unused.
 */
export const NEST_ENABLED: boolean = false;

/** Public V1 social/household sharing is source-locked off for release. */
export const SOCIAL_FEATURES_ENABLED: boolean = false;

/** V1 is free. This reserves a safe gate for a future StoreKit implementation. */
export const SUBSCRIPTIONS_ENABLED: boolean = false;

/** Deferred product areas. These gates apply to UI, routes, actions and jobs. */
export const GROCERY_ENABLED: boolean = false;
export const COACH_ENABLED: boolean = false;
export const NUTRITION_ENABLED: boolean = false;

export const GROCERY_DISABLED_ERROR = "Grocery is not available in this release.";
export const COACH_DISABLED_ERROR = "Coach is not available in this release.";
export const NUTRITION_DISABLED_ERROR = "Nutrition tracking is not available in this release.";

/** Rechecked when issuing and consuming permits, including older queued work. */
export function isAiPurposeEnabled(purpose: string): boolean {
  switch (purpose) {
    case "workout_plan":
    case "fitness_plan":
      return COACH_ENABLED;
    case "meal_plan":
    case "receipt_image":
      return GROCERY_ENABLED;
    case "food_image":
      return NUTRITION_ENABLED;
    case "morning_briefing":
    case "daily_plan":
    case "health_analysis":
    case "health_checkin":
      return true;
    default:
      return false;
  }
}

export const SOCIAL_DISABLED_ERROR =
  "Friends and household sharing are not available in this release.";
