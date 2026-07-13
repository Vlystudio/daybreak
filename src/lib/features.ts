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

export function enabledOnlyWhenExplicitlyTrue(value: string | undefined): boolean {
  return value === "true";
}

/** Public V1 social/household sharing flag. Missing or malformed is always off. */
export const SOCIAL_FEATURES_ENABLED: boolean = enabledOnlyWhenExplicitlyTrue(
  process.env.NEXT_PUBLIC_SOCIAL_FEATURES_ENABLED
);

/** V1 is free. This reserves a safe gate for a future StoreKit implementation. */
export const SUBSCRIPTIONS_ENABLED: boolean = false;

export const SOCIAL_DISABLED_ERROR =
  "Friends and household sharing are not available in this release.";
