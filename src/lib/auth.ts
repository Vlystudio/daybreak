import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { isUserEligible } from "@/lib/account-eligibility";
import { requiresMfaChallenge } from "@/lib/security/mfa";

/**
 * Resolve the authenticated user from the session cookie, server-side.
 * This is the ONLY source of user identity — user ids must never be
 * accepted from client input.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Auth-only gate for eligibility/account-recovery surfaces. */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Auth + current adult/legal eligibility gate used by all normal app pages and
 * Server Actions. RLS repeats this check at the data source, so this redirect is
 * user experience rather than the sole security boundary.
 */
export async function requireUser(): Promise<User> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) redirect("/login?error=session");
  if (requiresMfaChallenge(assurance)) redirect("/login/mfa");
  if (!(await isUserEligible(user.id))) redirect("/eligibility");
  return user;
}

/** Route-handler-friendly eligibility check that never redirects. */
export async function isAuthenticatedUserEligible(userId: string): Promise<boolean> {
  return isUserEligible(userId);
}
