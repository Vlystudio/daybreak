"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { securityRateLimit } from "@/lib/rate-limit";
import {
  ADULT_ATTESTATION_VERSION,
  LEGAL_APPLICATION_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/versions";

type Result = { ok: true } | { ok: false; error: string };

const eligibilitySchema = z.object({
  adultAttested: z.literal(true),
  acceptedTerms: z.literal(true),
  privacyAcknowledged: z.literal(true),
});

export async function completeAdultEligibility(input: {
  adultAttested: boolean;
  acceptedTerms: boolean;
  privacyAcknowledged: boolean;
}): Promise<Result> {
  const user = await requireAuthenticatedUser();
  const parsed = eligibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confirm adult eligibility and the current legal documents." };
  }

  const limited = await securityRateLimit(`adult-attestation:${user.id}`, {
    limit: 6,
    windowSeconds: 3600,
  });
  if (!limited.ok) return { ok: false, error: "Too many attempts. Try again later." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_current_user_eligibility", {
    p_adult_attested: true,
    p_adult_attestation_version: ADULT_ATTESTATION_VERSION,
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_application_version: LEGAL_APPLICATION_VERSION,
    p_platform: "web",
    p_locale: "en",
    p_acceptance_method: "eligibility_migration",
  });
  if (error) return { ok: false, error: "We couldn't save your eligibility decision." };
  redirect("/dashboard");
}

export async function reportCurrentAccountUnder18(): Promise<Result> {
  const user = await requireAuthenticatedUser();
  const limited = await securityRateLimit(`minor-restriction:${user.id}`, {
    limit: 2,
    windowSeconds: 86400,
  });
  if (!limited.ok)
    return { ok: false, error: "This request could not be processed. Contact support." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("restrict_current_user_as_minor");
  if (error) return { ok: false, error: "This request could not be processed. Contact support." };

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?restricted=minor");
}
