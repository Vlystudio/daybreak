import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AI_CONSENT_VERSION,
  aiConsentCategories,
  aiConsentFromPrefs,
  hasCurrentAiConsentDecision,
  type AiConsent,
  type AiConsentPreferences,
  type AiDataCategory,
  type AiPurpose,
} from "@/lib/integrations/ai-consent";
import { securityRateLimit } from "@/lib/rate-limit";

const PERMIT = Symbol("daybreak-ai-processing-permit");

export interface AiProcessingPermit {
  readonly permitId: string;
  readonly userId: string;
  readonly purpose: AiPurpose;
  readonly categories: readonly AiDataCategory[];
  readonly consent: AiConsent;
  readonly consentVersion: string;
  readonly consentEpoch: number;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly [PERMIT]: true;
}

const CONSENT_COLUMNS = [
  "allow_ai_basic_processing",
  "allow_ai_tasks_context",
  "allow_ai_health_context",
  "allow_ai_calendar_availability",
  "allow_ai_calendar_detail",
  "allow_ai_checkin_context",
  "allow_ai_profile_context",
  "allow_ai_uploads",
  "ai_consent_version",
  "ai_consent_updated_at",
  "ai_consent_expires_at",
].join(", ");

function nonceHash(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

/** Minted only by trusted server code; the database independently revalidates consent. */
export async function getAiProcessingPermit(
  userId: string,
  purpose: AiPurpose
): Promise<AiProcessingPermit | null> {
  const admin = createAdminClient();
  const { data: preferences, error: preferencesError } = await admin
    .from("user_preferences")
    .select(CONSENT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<AiConsentPreferences>();
  if (preferencesError || !hasCurrentAiConsentDecision(preferences)) return null;

  const consent = aiConsentFromPrefs(preferences);
  if (!consent.basic) return null;
  const categories = aiConsentCategories(consent);
  const nonce = randomBytes(32).toString("base64url");
  const { data, error } = await admin.rpc("issue_ai_processing_permit", {
    p_user_id: userId,
    p_purpose: purpose,
    p_categories: categories,
    p_nonce_hash: nonceHash(nonce),
  });
  const issued = (
    data as
      | { permit_id: string; consent_epoch: number; expires_at: string; max_uses: number }[]
      | null
  )?.[0];
  if (error || !issued) return null;

  return Object.freeze({
    permitId: issued.permit_id,
    userId,
    purpose,
    categories,
    consent,
    consentVersion: AI_CONSENT_VERSION,
    consentEpoch: issued.consent_epoch,
    expiresAt: issued.expires_at,
    nonce,
    [PERMIT]: true as const,
  });
}

export function assertAiProcessingPermit(
  permit: AiProcessingPermit | null | undefined,
  purpose?: AiPurpose,
  requiredCategories: readonly AiDataCategory[] = []
): asserts permit is AiProcessingPermit {
  if (!permit || permit[PERMIT] !== true) {
    throw new Error("A current server-issued AI processing consent permit is required.");
  }
  if (purpose && permit.purpose !== purpose) {
    throw new Error("The AI processing permit is not valid for this purpose.");
  }
  if (Date.parse(permit.expiresAt) <= Date.now()) {
    throw new Error("The AI processing permit has expired.");
  }
  const allowed = new Set(permit.categories);
  if (requiredCategories.some((category) => !allowed.has(category))) {
    throw new Error("The AI processing permit does not allow the requested data categories.");
  }
}

/**
 * Fail-closed egress authorization. Every provider call consumes one durable
 * use and rechecks eligibility, epoch, version, expiry, user, purpose, nonce,
 * and allowed categories in a single database update.
 */
export async function authorizeAiEgress(
  permit: AiProcessingPermit,
  purpose: AiPurpose,
  requiredCategories: readonly AiDataCategory[] = []
): Promise<void> {
  assertAiProcessingPermit(permit, purpose, requiredCategories);
  const limited = await securityRateLimit(`ai-egress:${permit.userId}`, {
    limit: 100,
    windowSeconds: 3600,
  });
  if (!limited.ok) throw new Error("AI processing is temporarily rate limited.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_processing_permit", {
    p_permit_id: permit.permitId,
    p_user_id: permit.userId,
    p_purpose: purpose,
    p_categories: [...permit.categories],
    p_nonce_hash: nonceHash(permit.nonce),
  });
  if (error || data !== true) {
    throw new Error("The AI processing permit could not be validated.");
  }
}

export const AI_CONSENT_REQUIRED_ERROR =
  "Review AI data use before using this feature. You can decline every optional category.";
