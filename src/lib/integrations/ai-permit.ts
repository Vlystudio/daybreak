import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  aiConsentFromPrefs,
  hasCurrentAiConsentDecision,
  type AiConsent,
  type AiConsentPreferences,
} from "@/lib/integrations/ai-consent";

const PERMIT = Symbol("daybreak-ai-processing-permit");

/** Opaque server-issued proof that the user completed the current AI disclosure. */
export interface AiProcessingPermit {
  readonly userId: string;
  readonly consent: AiConsent;
  readonly [PERMIT]: true;
}

const CONSENT_COLUMNS =
  "allow_ai_health_context, allow_ai_calendar_context, allow_ai_checkin_context, ai_consent_version, ai_consent_updated_at";

export async function getAiProcessingPermit(userId: string): Promise<AiProcessingPermit | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_preferences")
    .select(CONSENT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<AiConsentPreferences>();

  if (!hasCurrentAiConsentDecision(data)) return null;
  return { userId, consent: aiConsentFromPrefs(data), [PERMIT]: true };
}

export function assertAiProcessingPermit(permit: AiProcessingPermit | null | undefined): void {
  if (!permit || permit[PERMIT] !== true) {
    throw new Error("A current server-issued AI processing consent permit is required.");
  }
}

export const AI_CONSENT_REQUIRED_ERROR =
  "Review AI data use before using this feature. You can decline every optional category.";
