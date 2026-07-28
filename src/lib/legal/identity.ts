import "server-only";
import { z } from "zod";

export const LEGAL_IDENTITY_KEYS = [
  "LEGAL_OPERATOR_NAME",
  "LEGAL_PUBLIC_DEVELOPER_NAME",
  "LEGAL_GOVERNING_JURISDICTION",
  "LEGAL_BUSINESS_ADDRESS",
  "LEGAL_PRIVACY_EMAIL",
  "LEGAL_SECURITY_EMAIL",
  "LEGAL_SUPPORT_EMAIL",
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE",
  "LEGAL_HEALTH_PRIVACY_EFFECTIVE_DATE",
  "LEGAL_COPYRIGHT_OWNER",
  "LEGAL_APP_STORE_SELLER_NAME",
  "LEGAL_SUPPORT_URL",
  "LEGAL_PRIVACY_URL",
  "LEGAL_TERMS_URL",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.url().refine((url) => new URL(url).protocol === "https:", "must use HTTPS");

const identitySchema = z.object({
  operatorName: z.string().min(2).max(200),
  publicDeveloperName: z.string().min(2).max(200),
  governingJurisdiction: z.string().min(2).max(200),
  businessAddress: z.string().min(8).max(500),
  privacyEmail: z.email(),
  securityEmail: z.email(),
  supportEmail: z.email(),
  termsEffectiveDate: isoDate,
  privacyEffectiveDate: isoDate,
  healthPrivacyEffectiveDate: isoDate,
  copyrightOwner: z.string().min(2).max(200),
  appStoreSellerName: z.string().min(2).max(200),
  supportUrl: httpsUrl,
  privacyUrl: httpsUrl,
  termsUrl: httpsUrl,
});

export type LegalIdentity = z.infer<typeof identitySchema>;

const PLACEHOLDER =
  /(?:\bTODO\b|\bTBD\b|placeholder|example\.com|\.invalid\b|localhost|127\.0\.0\.1|123\s+main|acme|dummy|your\s+(?:company|entity|address)|unassigned|local development)/i;

export interface LegalIdentityValidation {
  ok: boolean;
  issues: string[];
  identity?: LegalIdentity;
}

export function validateProductionLegalIdentity(
  env: Record<string, string | undefined>
): LegalIdentityValidation {
  const candidate = {
    operatorName: env.LEGAL_OPERATOR_NAME,
    publicDeveloperName: env.LEGAL_PUBLIC_DEVELOPER_NAME,
    governingJurisdiction: env.LEGAL_GOVERNING_JURISDICTION,
    businessAddress: env.LEGAL_BUSINESS_ADDRESS,
    privacyEmail: env.LEGAL_PRIVACY_EMAIL,
    securityEmail: env.LEGAL_SECURITY_EMAIL,
    supportEmail: env.LEGAL_SUPPORT_EMAIL,
    termsEffectiveDate: env.LEGAL_TERMS_EFFECTIVE_DATE,
    privacyEffectiveDate: env.LEGAL_PRIVACY_EFFECTIVE_DATE,
    healthPrivacyEffectiveDate: env.LEGAL_HEALTH_PRIVACY_EFFECTIVE_DATE,
    copyrightOwner: env.LEGAL_COPYRIGHT_OWNER,
    appStoreSellerName: env.LEGAL_APP_STORE_SELLER_NAME,
    supportUrl: env.LEGAL_SUPPORT_URL,
    privacyUrl: env.LEGAL_PRIVACY_URL,
    termsUrl: env.LEGAL_TERMS_URL,
  };
  const parsed = identitySchema.safeParse(candidate);
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  for (const [key, value] of Object.entries(candidate)) {
    if (value && PLACEHOLDER.test(value)) issues.push(`${key}: placeholder value is forbidden`);
  }
  return parsed.success && issues.length === 0
    ? { ok: true, issues: [], identity: parsed.data }
    : { ok: false, issues };
}

const DEVELOPMENT_IDENTITY: LegalIdentity = {
  operatorName: "LOCAL DEVELOPMENT — not a production operator",
  publicDeveloperName: "Daybreak local development",
  governingJurisdiction: "LOCAL DEVELOPMENT ONLY",
  businessAddress: "LOCAL DEVELOPMENT ONLY — no business address configured",
  privacyEmail: "privacy@daybreak.invalid",
  securityEmail: "security@daybreak.invalid",
  supportEmail: "support@daybreak.invalid",
  termsEffectiveDate: "2026-07-28",
  privacyEffectiveDate: "2026-07-28",
  healthPrivacyEffectiveDate: "2026-07-28",
  copyrightOwner: "LOCAL DEVELOPMENT — no production owner configured",
  appStoreSellerName: "LOCAL DEVELOPMENT — no seller configured",
  supportUrl: "https://daybreak.invalid/support",
  privacyUrl: "https://daybreak.invalid/privacy",
  termsUrl: "https://daybreak.invalid/terms",
};

export function getLegalIdentity(): LegalIdentity {
  const result = validateProductionLegalIdentity(process.env);
  if (result.ok && result.identity) return result.identity;
  const repositoryOnlyCiBuild =
    process.env.CI === "true" &&
    process.env.LEGAL_REPOSITORY_BUILD === "true" &&
    !process.env.VERCEL &&
    !process.env.CM_BUILD_ID;
  if (process.env.NODE_ENV !== "production" || repositoryOnlyCiBuild) {
    return DEVELOPMENT_IDENTITY;
  }
  throw new Error(
    `Production legal identity is incomplete (${result.issues.length} validation issues).`
  );
}
