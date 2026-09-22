import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ADULT_ATTESTATION_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";

export type AccountEligibilityStatus =
  | "pending_adult_attestation"
  | "eligible"
  | "restricted_minor"
  | "suspended"
  | "deletion_pending";

export interface AccountEligibility {
  status: AccountEligibilityStatus;
  adult_attested: boolean;
  adult_attestation_version: string | null;
  terms_version: string | null;
  privacy_version: string | null;
}

export function isCurrentEligibility(eligibility: AccountEligibility | null | undefined): boolean {
  return (
    eligibility?.status === "eligible" &&
    eligibility.adult_attested === true &&
    eligibility.adult_attestation_version === ADULT_ATTESTATION_VERSION &&
    eligibility.terms_version === TERMS_VERSION &&
    eligibility.privacy_version === PRIVACY_VERSION
  );
}

export async function getAccountEligibility(userId: string): Promise<AccountEligibility | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_eligibility")
    .select("status, adult_attested, adult_attestation_version, terms_version, privacy_version")
    .eq("user_id", userId)
    .maybeSingle<AccountEligibility>();
  if (error) return null;
  return data;
}

export async function isUserEligible(userId: string): Promise<boolean> {
  return isCurrentEligibility(await getAccountEligibility(userId));
}
