import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const allowExternalBlockers = args.has("--allow-external-blockers");
const writeEvidence = !args.has("--no-write-evidence");
const evidencePath = join(root, "build", "release-evidence", "app-store-sections-1-8.json");
const results = [];

const STATUS = {
  pass: "PASS — automatically verified",
  fail: "FAIL — implementation or test failure",
  blocked: "BLOCKED — requires external/manual evidence",
  na: "NOT APPLICABLE — with documented justification",
};

function add(id, status, detail, evidence = []) {
  results.push({ id, status: STATUS[status], detail, evidence });
}

function text(path) {
  return readFileSync(join(root, path), "utf8");
}

function json(path) {
  return JSON.parse(text(path));
}

function optionalJson(path) {
  if (!exists(path)) return null;
  try {
    return json(path);
  } catch {
    return null;
  }
}

function exists(path) {
  try {
    return statSync(join(root, path)).isFile();
  } catch {
    return false;
  }
}

function filesUnder(path) {
  const base = join(root, path);
  const output = [];
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else output.push(relative(root, full).replaceAll("\\", "/"));
    }
  }
  visit(base);
  return output;
}

function command(id, commandPath, commandArgs, evidence) {
  try {
    const output = execFileSync(commandPath, commandArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    add(id, "pass", output.split(/\r?\n/).at(-1) || "Command passed.", evidence);
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
    add(id, "fail", output.split(/\r?\n/).slice(-4).join(" | ") || "Command failed.", evidence);
  }
}

command(
  "MIGRATION-INTEGRITY",
  process.execPath,
  ["scripts/check-migrations.mjs"],
  ["scripts/check-migrations.mjs", "docs/architecture/adr-migration-0021-reconciliation.md"]
);
command(
  "GENERATED-COMPLIANCE",
  process.execPath,
  ["scripts/generate-compliance-docs.mjs", "--check"],
  ["scripts/generate-compliance-docs.mjs", "THIRD_PARTY_NOTICES"]
);
command(
  "MIGRATION-DISCOVERY-STATIC",
  process.execPath,
  [
    "scripts/discover-migration-state.mjs",
    "--read-only",
    "--expected-project-ref",
    "cybpuscssilbguypptxi",
    "--static-check",
  ],
  ["scripts/discover-migration-state.mjs", "scripts/sql/migration-discovery-read-only.sql"]
);

const requiredFiles = [
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/legal/consumer-health-privacy/page.tsx",
  "src/app/legal/health-disclaimer/page.tsx",
  "src/app/legal/ai/page.tsx",
  "src/app/legal/acceptable-use/page.tsx",
  "src/app/legal/retention/page.tsx",
  "src/app/legal/copyright/page.tsx",
  "src/app/security/page.tsx",
  "src/app/.well-known/security.txt/route.ts",
  "src/app/account-deletion/status/page.tsx",
  "src/app/api/cron/account-deletion/route.ts",
  "src/app/api/cron/retention/route.ts",
  "native/ios/PrivacyInfo.xcprivacy",
  "config/privacy/data-inventory.json",
  "config/privacy/processors.json",
  "config/privacy/ai-providers.json",
  "config/privacy/ios-sdk-inventory.json",
  "config/legal/ip-assets.json",
  "config/legal/license-policy.json",
  "docs/architecture/adult-only-policy.md",
  "docs/launch-readiness/product-surface-audit.md",
  "docs/launch-readiness/sections-1-8-evidence-matrix.md",
  "scripts/verify-production-environment.mjs",
  "scripts/staging-account-deletion.mjs",
  "scripts/verify-supabase-auth-config.mjs",
  "scripts/validate-physical-device-results.mjs",
  "scripts/write-ios-privacy-inventory.mjs",
  "scripts/validate-ios-signing-evidence.mjs",
  "native/ios/UITests/DaybreakUITests.swift",
  "docs/legal/attorney-review-package/README.md",
  "docs/app-store/submission-package/README.md",
  "docs/testing/physical-iphone-matrix.md",
  "docs/launch-readiness/launch-dashboard.md",
];
const missingFiles = requiredFiles.filter((path) => !exists(path));
add(
  "REQUIRED-DELIVERABLES",
  missingFiles.length ? "fail" : "pass",
  missingFiles.length
    ? `Missing: ${missingFiles.join(", ")}`
    : `${requiredFiles.length} required code/configuration artifacts exist.`,
  requiredFiles
);

const versions = json("config/legal/legal-requirements.json").documentVersions;
const migration0049 = text("supabase/migrations/0049_adult_eligibility_and_legal_acceptance.sql");
const legalVersionSource = text("src/lib/legal/versions.ts");
const missingVersions = Object.entries(versions).filter(
  ([type, version]) =>
    !migration0049.includes(`('${type}', '${version}'`) ||
    ((type === "terms" || type === "privacy") && !legalVersionSource.includes(`= "${version}"`))
);
add(
  "LEGAL-VERSION-CONSISTENCY",
  missingVersions.length ? "fail" : "pass",
  missingVersions.length
    ? `Version mismatch: ${missingVersions.map(([type]) => type).join(", ")}`
    : "Configured document versions match the database seed and runtime constants.",
  [
    "config/legal/legal-requirements.json",
    "src/lib/legal/versions.ts",
    "supabase/migrations/0049_adult_eligibility_and_legal_acceptance.sql",
  ]
);

const authAction = text("src/actions/auth.ts");
const authGate = text("src/lib/auth.ts");
const signupUi = text("src/components/auth/auth-form.tsx");
const adultChecks = [
  /adult_attested:\s*true/.test(authAction),
  /adult_attestation_version/.test(authAction),
  /current explicit adult attestation and legal acceptance are required/.test(migration0049),
  /create or replace function public\.handle_new_user/.test(migration0049),
  /await isUserEligible\(user\.id\)/.test(authGate),
  /I confirm that I am at least 18 years old/.test(signupUi),
];
add(
  "ADULT-ELIGIBILITY",
  adultChecks.every(Boolean) ? "pass" : "fail",
  adultChecks.every(Boolean)
    ? "Unchecked UI attestation, auth-trigger enforcement for all providers, and existing-user gating are present."
    : "One or more adult-eligibility enforcement layers are missing.",
  [
    "src/actions/auth.ts",
    "src/components/auth/auth-form.tsx",
    "src/lib/auth.ts",
    "supabase/tests/adult_eligibility_test.sql",
  ]
);

const proxySource = text("src/proxy.ts");
const mfaGateSource = text("src/lib/security/mfa.ts");
const accountCardSource = text("src/components/settings/account-card.tsx");
const minorAdminRoute = text("src/app/api/admin/restrict-minor/route.ts");
const backfillAdminRoute = text("src/app/api/admin/backfill-observations/route.ts");
const authHardeningChecks = [
  /getAuthenticatorAssuranceLevel/.test(proxySource),
  /getAuthenticatorAssuranceLevel/.test(authGate),
  /nextLevel === "aal2"/.test(mfaGateSource),
  /challengeAndVerify/.test(text("src/components/auth/mfa-challenge-form.tsx")),
  /scope:\s*"global"/.test(authAction),
  /signOutAllDevices/.test(accountCardSource),
  /verifyAdminAuth/.test(minorAdminRoute),
  !/verifyCronAuth/.test(minorAdminRoute),
  /verifyAdminAuth/.test(backfillAdminRoute),
  !/verifyCronAuth/.test(backfillAdminRoute),
  /ADMIN_ACTION_SECRET/.test(text("src/lib/security/admin-auth.ts")),
];
add(
  "AUTHENTICATION-HARDENING",
  authHardeningChecks.every(Boolean) ? "pass" : "fail",
  authHardeningChecks.every(Boolean)
    ? "Server and request gates enforce AAL2 for enrolled accounts, global session revocation is exposed, and admin routes have a dedicated credential."
    : "MFA enforcement, global session revocation, or the dedicated admin authorization boundary is incomplete.",
  [
    "src/proxy.ts",
    "src/lib/auth.ts",
    "src/app/login/mfa/page.tsx",
    "docs/architecture/authentication-hardening.md",
  ]
);

const deletionCode = text("src/lib/account-deletion.ts");
const tokenCode = text("src/lib/integrations/tokens.ts");
const deletionMigration = text("supabase/migrations/0050_durable_account_deletion.sql");
const deletionChecks = [
  /claim_account_deletion_job/.test(deletionCode),
  /provider grant revocation/.test(deletionCode),
  /authentication account and sessions/.test(deletionCode),
  /name:\s*"provider grant revocation"[\s\S]*\.\.\.buildAccountDeletionSteps/.test(deletionCode),
  /oauth2\.googleapis\.com\/revoke/.test(tokenCode),
  /api\.fitbit\.com\/oauth2\/revoke/.test(tokenCode),
  /api\.ouraring\.com\/oauth\/revoke/.test(tokenCode),
  /complete_account_deletion_job/.test(deletionCode),
  /complete_account_deletion_job/.test(deletionMigration),
  /drop constraint account_deletion_jobs_user_id_fkey/.test(deletionMigration),
  /delete from public\.account_deletion_jobs/.test(deletionMigration),
  !/abandoned_after_retries/.test(deletionCode),
];
add(
  "DURABLE-DELETION",
  deletionChecks.every(Boolean) ? "pass" : "fail",
  deletionChecks.every(Boolean)
    ? "Durable claim/retry/status flow revokes provider grants, deletes Auth last, and atomically finalizes the receipt/job without abandoning retries."
    : "The durable deletion or provider-revocation invariant is incomplete.",
  [
    "src/lib/account-deletion.ts",
    "src/lib/integrations/tokens.ts",
    "supabase/migrations/0050_durable_account_deletion.sql",
  ]
);

const migrations = filesUnder("supabase/migrations").filter((path) => path.endsWith(".sql"));
const allSql = migrations.map(text).join("\n").toLowerCase();
const createdTables = new Set(
  [...allSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g)].map(
    (match) => match[1]
  )
);
const missingRls = [...createdTables].filter(
  (table) =>
    !new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i"
    ).test(allSql)
);
add(
  "DATABASE-RLS-DECLARATIONS",
  missingRls.length ? "fail" : "pass",
  missingRls.length
    ? `Tables without an RLS enable statement: ${missingRls.join(", ")}`
    : `All ${createdTables.size} public tables created by active migrations enable RLS.`,
  ["supabase/migrations", "supabase/tests/rls_isolation_test.sql"]
);

const sourceFiles = filesUnder("src").filter((path) => /\.(?:ts|tsx)$/.test(path));
const directConsole = sourceFiles.filter(
  (path) =>
    path !== "src/lib/security/safe-logger.ts" &&
    /console\.(?:log|info|warn|error|debug)\s*\(/.test(text(path))
);
add(
  "CENTRAL-LOGGING",
  directConsole.length ? "fail" : "pass",
  directConsole.length
    ? `Direct console calls: ${directConsole.join(", ")}`
    : "Application logging is centralized and sensitive-key redaction is tested.",
  [
    "src/lib/security/safe-logger.ts",
    "src/lib/security/safe-logger.test.ts",
    "src/lib/security/sentry-scrub.ts",
  ]
);

const clientSecretFindings = sourceFiles.filter((path) => {
  const source = text(path);
  return (
    /^\s*["']use client["'];/m.test(source) &&
    /(?:SUPABASE_SERVICE_ROLE_KEY|TOKEN_ENCRYPTION_KEY|CLIENT_SECRET|OPENAI_API_KEY|LOGMEAL_API_KEY)/.test(
      source
    )
  );
});
add(
  "CLIENT-SECRETS",
  clientSecretFindings.length ? "fail" : "pass",
  clientSecretFindings.length
    ? `Client secret reference: ${clientSecretFindings.join(", ")}`
    : "No server credential names are referenced by client modules.",
  ["src"]
);

const featureSource = text("src/lib/features.ts");
const gameActions = text("src/actions/game.ts");
const productionSurfaceChecks = [
  /NEST_ENABLED:\s*boolean\s*=\s*false/.test(featureSource),
  /SOCIAL_FEATURES_ENABLED:\s*boolean\s*=\s*false/.test(featureSource),
  /SUBSCRIPTIONS_ENABLED:\s*boolean\s*=\s*false/.test(featureSource),
  (gameActions.match(/if \(!NEST_ENABLED\) return/g) ?? []).length === 6,
];
add(
  "PRODUCTION-SURFACE",
  productionSurfaceChecks.every(Boolean) ? "pass" : "fail",
  productionSurfaceChecks.every(Boolean)
    ? "Nest, social/household, subscription UI, and disabled game mutations are source-locked off for V1."
    : "One or more non-V1 surfaces can be enabled or mutated in the release source.",
  ["src/lib/features.ts", "src/actions/game.ts", "docs/launch-readiness/product-surface-audit.md"]
);

const directAiClients = sourceFiles.filter((path) => {
  const source = text(path);
  if (path === "src/lib/integrations/openai.ts") return false;
  return /new\s+OpenAI\s*\(|api\.openai\.com/.test(source);
});
const clientAiDestinations = sourceFiles.filter((path) => {
  const source = text(path);
  return (
    /^\s*["']use client["'];/m.test(source) && /(?:api\.openai\.com|api\.logmeal\.)/.test(source)
  );
});
const permitBoundary = text("src/lib/integrations/openai.ts");
const aiBoundaryOk =
  directAiClients.length === 0 &&
  clientAiDestinations.length === 0 &&
  /await authorizeAiEgress\(permit, purpose, requiredCategories\)/.test(permitBoundary);
add(
  "AI-EGRESS-BOUNDARY",
  aiBoundaryOk ? "pass" : "fail",
  aiBoundaryOk
    ? "No client or alternate OpenAI client bypass exists; provider initialization consumes a server permit."
    : `AI bypass findings: ${[...directAiClients, ...clientAiDestinations].join(", ") || "permit authorization missing"}`,
  [
    "src/lib/integrations/openai.ts",
    "src/lib/integrations/ai-permit.ts",
    "src/lib/integrations/food-vision.ts",
  ]
);

const analyticsRegistry = json("config/privacy/analytics-events.json");
const analyticsSource = text("src/lib/privacy/analytics.ts");
const directAnalytics = sourceFiles.filter((path) => {
  if (
    [
      "src/lib/privacy/analytics.ts",
      "src/lib/account-deletion.ts",
      "src/lib/privacy/data-export.ts",
    ].includes(path)
  )
    return false;
  return /analytics_events/.test(text(path));
});
const analyticsOk =
  analyticsRegistry.events.length > 0 &&
  analyticsRegistry.events.every((event) => Array.isArray(event.allowedMetadataKeys)) &&
  /FORBIDDEN/.test(analyticsSource) &&
  directAnalytics.length === 0;
add(
  "ANALYTICS-ALLOWLIST",
  analyticsOk ? "pass" : "fail",
  analyticsOk
    ? "Analytics accepts only allowlisted events, primitive metadata, and non-sensitive keys/values."
    : `Analytics bypass or registry problem${directAnalytics.length ? `: ${directAnalytics.join(", ")}` : "."}`,
  [
    "config/privacy/analytics-events.json",
    "src/lib/privacy/analytics.ts",
    "src/lib/privacy/analytics.test.ts",
  ]
);

const capacitor = text("capacitor.config.ts");
const releaseConfigOk =
  /url:\s*"https:\/\/daybreak-one\.vercel\.app"/.test(capacitor) &&
  /cleartext:\s*false/.test(capacitor) &&
  !/url:\s*"http:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.)/.test(capacitor);
add(
  "RELEASE-ENDPOINTS",
  releaseConfigOk ? "pass" : "fail",
  releaseConfigOk
    ? "The native release shell uses the fixed HTTPS production origin with cleartext disabled."
    : "The native release configuration contains an invalid or development endpoint.",
  ["capacitor.config.ts", "scripts/ios-release-validate.sh"]
);

const codemagic = text("codemagic.yaml");
const codemagicRequirements = [
  "xcode: 26.0",
  "cache_paths:",
  "npm ci --no-audit --no-fund",
  "npm run typecheck",
  "npm run lint",
  "npm run test:run",
  "npm run compliance:generate",
  "git diff --exit-code",
  "npm run migration:discover:static",
  "npm run release:verify-production",
  "npx cap sync ios",
  "xcode-project build-ipa",
  "scripts/ios-release-validate.sh",
  "submit_to_testflight: true",
  "build/ios/ipa/*.ipa",
  "build/ios/archive/*.xcarchive",
  "build/release-evidence/*.json",
];
const missingCodemagic = codemagicRequirements.filter((needle) => !codemagic.includes(needle));
add(
  "CODEMAGIC-RELEASE-AUTOMATION",
  missingCodemagic.length ? "fail" : "pass",
  missingCodemagic.length
    ? `Codemagic release controls missing: ${missingCodemagic.join(", ")}`
    : "Codemagic pins the toolchain, runs deterministic validation, fails closed on production approvals/configuration, signs, validates, retains artifacts/evidence, and uploads to TestFlight.",
  ["codemagic.yaml", "scripts/verify-production-environment.mjs", "scripts/ios-release-validate.sh"]
);

const nativeUiTests = text("native/ios/UITests/DaybreakUITests.swift");
const uiInstaller = text("scripts/ios-install-ui-tests.rb");
const stableUiIds = [
  "signup-adult-attestation",
  "signup-under-18",
  "auth-submit",
  "eligibility-confirm",
  "ai-consent-",
  "privacy-export",
  "account-delete-submit",
  "apple-health-authorize",
  "mfa-submit",
];
const nativePreparationOk =
  /performAccessibilityAudit/.test(nativeUiTests) &&
  /XCTAttachment\(screenshot:/.test(nativeUiTests) &&
  /requiredFixture/.test(nativeUiTests) &&
  /UI tests refuse the production origin/.test(uiInstaller) &&
  stableUiIds.every((identifier) =>
    sourceFiles.some((sourcePath) => text(sourcePath).includes(identifier))
  );
add(
  "NATIVE-TEST-PREPARATION",
  nativePreparationOk ? "pass" : "fail",
  nativePreparationOk
    ? "A nonproduction-only generated XCUITest target, stable UI identifiers, launch arguments, screenshots, fixture-gated auth tests, and accessibility audit are prepared without a release reset backdoor."
    : "Native UI test preparation, production-origin refusal, or stable accessibility identifiers are incomplete.",
  [
    "native/ios/UITests/DaybreakUITests.swift",
    "scripts/ios-install-ui-tests.rb",
    "docs/testing/native-ios-automated-tests.md",
  ]
);

const physicalScenarios = json("config/testing/physical-device-scenarios.json").scenarios;
const physicalPackageOk =
  physicalScenarios.length === 70 &&
  new Set(physicalScenarios.map((scenario) => scenario.id)).size === physicalScenarios.length &&
  /not_applicable/.test(text("scripts/validate-physical-device-results.mjs")) &&
  /unresolved failed scenarios/.test(text("scripts/validate-physical-device-results.mjs"));
add(
  "PHYSICAL-DEVICE-PACKAGE",
  physicalPackageOk ? "pass" : "fail",
  physicalPackageOk
    ? "The structured 70-scenario owner form and fail-closed validator cover the complete required physical-iPhone matrix."
    : "The physical-device scenario set or completion validator is incomplete.",
  [
    "config/testing/physical-device-scenarios.json",
    "scripts/generate-physical-device-form.mjs",
    "scripts/validate-physical-device-results.mjs",
  ]
);

const purposeSource = text("scripts/ios-prepare.sh");
const purposeOk = [
  "NSHealthShareUsageDescription",
  "NSHealthUpdateUsageDescription",
  "sleep, heart-rate, activity, body, and workout summaries",
  "requests no Apple Health write access",
  "AI provider only if you separately enable Health AI sharing",
].every((needle) => purposeSource.includes(needle));
add(
  "HEALTHKIT-PURPOSE-STRINGS",
  purposeOk ? "pass" : "fail",
  purposeOk
    ? "HealthKit purpose strings name data categories, server transfer, read-only scope, and separate AI consent."
    : "HealthKit purpose strings are missing required scope or disclosure text.",
  ["scripts/ios-prepare.sh", "src/lib/integrations/apple-health/purpose-strings.test.ts"]
);

const privacyManifest = text("native/ios/PrivacyInfo.xcprivacy");
const manifestTypes = [
  "Health",
  "Fitness",
  "Name",
  "EmailAddress",
  "UserID",
  "CoarseLocation",
  "PhotosorVideos",
  "OtherUserContent",
  "SensitiveInfo",
  "OtherDataTypes",
  "DeviceID",
  "ProductInteraction",
  "CrashData",
  "PerformanceData",
];
const missingManifestTypes = manifestTypes.filter(
  (type) => !privacyManifest.includes(`NSPrivacyCollectedDataType${type}`)
);
const manifestOk =
  missingManifestTypes.length === 0 &&
  /<key>NSPrivacyTracking<\/key><false\/>/.test(privacyManifest) &&
  /<key>NSPrivacyAccessedAPITypes<\/key><array\/>/.test(privacyManifest) &&
  !privacyManifest.includes("NSPrivacyCollectedDataTypePreciseLocation");
add(
  "APPLE-PRIVACY-MANIFEST",
  manifestOk ? "pass" : "fail",
  manifestOk
    ? "Source manifest declares the inventoried data classes, no tracking, and no direct required-reason APIs."
    : `Privacy manifest mismatch: ${missingManifestTypes.join(", ") || "tracking/location/required-reason declaration"}`,
  [
    "native/ios/PrivacyInfo.xcprivacy",
    "config/privacy/data-inventory.json",
    "config/privacy/ios-sdk-inventory.json",
  ]
);

const notificationSources = [text("src/lib/notifications.ts"), text("src/lib/weekly-digest.ts")]
  .join("\n")
  .toLowerCase();
const forbiddenNotification = [
  "readiness_score",
  "sleep_score",
  "heart rate:",
  "calendar title",
  "check-in note",
];
const foundNotification = forbiddenNotification.filter((value) =>
  notificationSources.includes(value)
);
add(
  "NOTIFICATION-PRIVACY",
  foundNotification.length ? "fail" : "pass",
  foundNotification.length
    ? `Sensitive notification content found: ${foundNotification.join(", ")}`
    : "Push and email notification bodies are neutral and require in-app review for personal content.",
  [
    "src/lib/notifications.ts",
    "src/lib/weekly-digest.ts",
    "src/lib/notifications.test.ts",
    "src/lib/weekly-digest.test.ts",
  ]
);

const birthYearReferences = sourceFiles.filter(
  (path) => !path.endsWith(".test.ts") && /birth_year|birthYear/.test(text(path))
);
add(
  "MINOR-DATA-MINIMIZATION",
  birthYearReferences.length ? "fail" : "pass",
  birthYearReferences.length
    ? `Birth-year collection remains in runtime code: ${birthYearReferences.join(", ")}`
    : "Runtime birth-year collection is removed; migration 0053 restricts clear known-minor history then erases it.",
  [
    "supabase/migrations/0053_birth_year_data_minimization.sql",
    "docs/operations/minor-account-response.md",
  ]
);

const legalRequired = json("config/legal/legal-requirements.json").requiredProductionEnvironment;
const placeholder =
  /(?:\bTODO\b|\bTBD\b|placeholder|example\.com|\.invalid\b|localhost|127\.0\.0\.1|123\s+main|acme|dummy|your\s+(?:company|entity|address)|unassigned|local development)/i;
const invalidLegalEnv = legalRequired.filter(
  (key) => !process.env[key]?.trim() || placeholder.test(process.env[key])
);
add(
  "PRODUCTION-LEGAL-IDENTITY",
  invalidLegalEnv.length ? "blocked" : "pass",
  invalidLegalEnv.length
    ? `${invalidLegalEnv.length} required production identity values are absent or placeholders.`
    : "A complete non-placeholder production legal identity is present in this verification environment.",
  ["config/legal/legal-requirements.json", "src/lib/legal/identity.ts"]
);

const processors = json("config/privacy/processors.json").processors;
const unapprovedProcessors = processors.filter(
  (processor) =>
    processor.approvalStatus !== "approved" ||
    !processor.enabledEnvironments.includes("production") ||
    !processor.owner ||
    /unassigned/i.test(processor.owner) ||
    !processor.evidence
);
add(
  "PROCESSOR-APPROVALS",
  unapprovedProcessors.length ? "blocked" : "pass",
  unapprovedProcessors.length
    ? `Production approval evidence is incomplete for: ${unapprovedProcessors.map((p) => p.id).join(", ")}`
    : "Every production processor has an owner, approval, production enablement, and evidence reference.",
  ["config/privacy/processors.json", "docs/legal/processor-inventory.md"]
);

const aiProviders = json("config/privacy/ai-providers.json").providers;
const unapprovedAi = aiProviders.filter(
  (provider) =>
    provider.approvalStatus !== "approved" ||
    !provider.enabledEnvironments.includes("production") ||
    !provider.owner ||
    /unassigned/i.test(provider.owner)
);
add(
  "AI-PROVIDER-APPROVALS",
  unapprovedAi.length ? "blocked" : "pass",
  unapprovedAi.length
    ? `Production AI is fail-closed pending approval for: ${unapprovedAi.map((p) => p.id).join(", ")}`
    : "All registered AI providers are approved for production.",
  ["config/privacy/ai-providers.json", "src/lib/integrations/ai-provider-registry.ts"]
);

const attorneyEvidence = json("config/legal/legal-requirements.json").attorneyApprovalEvidence;
const attorneyRecord = optionalJson(attorneyEvidence);
const attorneyApproved =
  attorneyRecord?.status === "approved" &&
  typeof attorneyRecord.reviewer === "string" &&
  attorneyRecord.reviewer.trim().length > 0 &&
  !Number.isNaN(Date.parse(attorneyRecord.approvedAt ?? "")) &&
  Array.isArray(attorneyRecord.documents) &&
  attorneyRecord.documents.length >= 8;
add(
  "ATTORNEY-APPROVAL",
  attorneyApproved ? "pass" : "blocked",
  attorneyApproved
    ? "Dated attorney approval identifies the reviewer and exact document set."
    : "No valid approved attorney record identifies a reviewer, date, and exact public document set.",
  [attorneyEvidence, "docs/launch-readiness/manual-legal-gates.md"]
);

const licensePolicy = json("config/legal/license-policy.json");
const missingLicenseReview = Object.entries(licensePolicy.manualReviewEvidence).filter(
  ([, evidence]) => !evidence || !exists(evidence)
);
add(
  "MANUAL-LICENSE-REVIEW",
  missingLicenseReview.length ? "blocked" : "pass",
  missingLicenseReview.length
    ? `Manual license evidence is absent for ${missingLicenseReview.map(([license]) => license).join(", ")}.`
    : "All manual-review license categories have repository evidence.",
  ["config/legal/license-policy.json", "docs/legal/ip-and-license-inventory.md"]
);

const assets = json("config/legal/ip-assets.json").assets;
const missingAssetEvidence = assets.filter(
  (asset) =>
    asset.reviewStatus === "external_evidence_required" &&
    (!asset.evidence || !exists(asset.evidence))
);
add(
  "ASSET-OWNERSHIP",
  missingAssetEvidence.length ? "blocked" : "pass",
  missingAssetEvidence.length
    ? `Ownership evidence is absent for: ${missingAssetEvidence.map((asset) => asset.name).join(", ")}`
    : "All shipped asset ownership records have evidence.",
  ["config/legal/ip-assets.json", "docs/launch-readiness/evidence/02-ownership-and-licenses"]
);

const productionMigrationEvidence =
  "docs/launch-readiness/evidence/database/production-migration-discovery.json";
const databaseEvidence = "docs/launch-readiness/evidence/database/fresh-and-upgrade-test.json";
const productionMigrationRecord = optionalJson(productionMigrationEvidence);
const productionMigrationClassification = productionMigrationRecord?.classification;
const productionMigrationPass =
  productionMigrationRecord?.mode === "server-enforced read-only discovery" &&
  productionMigrationRecord?.productionWritesPerformed === false &&
  productionMigrationClassification?.forwardReconciliationApplied === true &&
  productionMigrationClassification?.repositoryHeadApplied === true &&
  productionMigrationClassification?.partialState === false &&
  productionMigrationClassification?.reconciliationNeeded === false;
const databaseRecord = optionalJson(databaseEvidence);
const databasePass =
  databaseRecord?.schemaVersion >= 2 &&
  databaseRecord?.status === "pass" &&
  databaseRecord?.freshInitialization?.status === "pass" &&
  databaseRecord?.duplicate0021AndRepresentativeUpgrades?.status === "pass" &&
  databaseRecord?.pgTapAndRuntimeSecurity?.status === "pass" &&
  databaseRecord?.productionAccessed === false;
add(
  "PRODUCTION-MIGRATION-HISTORY",
  productionMigrationPass ? "pass" : "blocked",
  productionMigrationPass
    ? "Read-only evidence confirms a consistent, forward-reconciled production schema at repository head."
    : "Valid read-only production evidence does not yet confirm a consistent forward-reconciled schema at repository head.",
  [productionMigrationEvidence, "scripts/discover-migration-state.mjs"]
);
add(
  "DATABASE-INTEGRATION",
  databasePass ? "pass" : "blocked",
  databasePass
    ? "Canonical evidence confirms fresh initialization, upgrade fixtures, two pgTAP/runtime-security passes, and no production access."
    : "No valid complete-suite evidence confirms fresh/upgrade migrations and two pgTAP/runtime-security executions.",
  [databaseEvidence, "scripts/test-db-local.mjs", "supabase/tests"]
);

const stagingDeletionEvidence =
  "docs/launch-readiness/evidence/04-auth-and-accounts/staging-account-deletion.json";
const stagingDeletionRecord = optionalJson(stagingDeletionEvidence);
const stagingDeletionTechnicalPass =
  /^technical_deletion_pass_/.test(stagingDeletionRecord?.verdict ?? "") &&
  stagingDeletionRecord?.zeroResidue === true &&
  stagingDeletionRecord?.unrelatedUserUnchanged === true &&
  stagingDeletionRecord?.flow?.completed === true &&
  stagingDeletionRecord?.flow?.authenticationRejectedAfterDeletion === true;
const stagingDeletionProviderPass =
  stagingDeletionRecord?.providerRevocation?.refreshInvalidation === "pass";
add(
  "STAGING-DELETION-PROOF",
  stagingDeletionTechnicalPass && stagingDeletionProviderPass ? "pass" : "blocked",
  stagingDeletionTechnicalPass
    ? "Staging deletion and residue checks passed, but actual provider refresh-token invalidation still requires owner-supplied provider evidence."
    : "A valid representative staging deletion, residue, control-user, Auth, and provider test record is unavailable.",
  [stagingDeletionEvidence, "docs/account-deletion-inventory.md"]
);

const authProviderEvidence =
  "docs/launch-readiness/evidence/04-auth-and-accounts/auth-provider-configuration.json";
const authProviderRecord = optionalJson(authProviderEvidence);
add(
  "AUTH-PROVIDER-CONFIGURATION",
  authProviderRecord?.status === "pass" ? "pass" : "blocked",
  authProviderRecord?.status === "pass"
    ? "Sanitized evidence confirms every repository and supplied Supabase Auth setting check."
    : "Supabase dashboard policy and staged session/MFA behavior lack a complete passing sanitized record.",
  [authProviderEvidence, "docs/architecture/authentication-hardening.md"]
);

const appleArchiveEvidence = "docs/launch-readiness/evidence/08-apple-privacy/ios-archive.json";
const xcodePrivacyEvidence =
  "docs/launch-readiness/evidence/08-apple-privacy/xcode-privacy-report.json";
const physicalDeviceEvidence =
  "docs/launch-readiness/evidence/05-health-and-healthkit/physical-iphone-test.json";
const archiveRecord = optionalJson(appleArchiveEvidence);
const archivePass =
  archiveRecord?.application?.bundleId === "app.daybreak.mobile" &&
  /^[0-9a-f]{64}$/i.test(archiveRecord?.ipa?.sha256 ?? "") &&
  archiveRecord?.verified &&
  Object.values(archiveRecord.verified).every((value) => value === true);
add(
  "SIGNED-IOS-ARCHIVE",
  archivePass ? "pass" : "blocked",
  archivePass
    ? "Signed archive evidence confirms every required signing, entitlement, artifact, and metadata check."
    : "No valid signed IPA/archive/dSYM evidence from the pinned macOS build exists.",
  [appleArchiveEvidence, "docs/launch-readiness/manual-apple-gates.md"]
);
const xcodePrivacyRecord = optionalJson(xcodePrivacyEvidence);
const xcodePrivacyPass =
  xcodePrivacyRecord?.status === "pass" &&
  xcodePrivacyRecord?.aggregateReportReviewed === true &&
  xcodePrivacyRecord?.sdkManifestInventoryReconciled === true &&
  xcodePrivacyRecord?.requiredReasonApisReconciled === true &&
  xcodePrivacyRecord?.trackingDeclarationsReconciled === true &&
  xcodePrivacyRecord?.collectedDataTypesReconciled === true &&
  xcodePrivacyRecord?.sdkSignaturesReconciled === true &&
  typeof xcodePrivacyRecord?.archiveIpaSha256 === "string" &&
  /^[0-9a-f]{64}$/i.test(xcodePrivacyRecord.archiveIpaSha256);
add(
  "XCODE-PRIVACY-REPORT",
  xcodePrivacyPass ? "pass" : "blocked",
  xcodePrivacyPass
    ? "The final-archive aggregate privacy report is tied to the candidate checksum and reconciled."
    : "No passing final-archive Xcode aggregate privacy-report reconciliation exists.",
  [xcodePrivacyEvidence, "docs/app-store/xcode-privacy-report-runbook.md"]
);
const physicalRecord = optionalJson(physicalDeviceEvidence);
const physicalScenarioCount = json("config/testing/physical-device-scenarios.json").scenarios
  .length;
const physicalPass =
  physicalRecord?.status === "pass" &&
  physicalRecord?.candidate?.bundleId === "app.daybreak.mobile" &&
  /^[0-9a-f]{40}$/i.test(physicalRecord?.candidate?.commit ?? "") &&
  /^[0-9a-f]{64}$/i.test(physicalRecord?.candidate?.ipaSha256 ?? "") &&
  physicalRecord?.summary?.total === physicalScenarioCount &&
  physicalRecord?.summary?.failed === 0 &&
  Array.isArray(physicalRecord?.results) &&
  physicalRecord.results.every((result) => ["pass", "not_applicable"].includes(result.result));
add(
  "PHYSICAL-IPHONE-TEST",
  physicalPass ? "pass" : "blocked",
  physicalPass
    ? `Owner/QA evidence completes all ${physicalScenarioCount} physical-device scenarios for one exact signed candidate.`
    : `All ${physicalScenarioCount} scenarios require complete owner/QA evidence from one exact signed build on a physical iPhone.`,
  [physicalDeviceEvidence, "docs/testing/physical-iphone-matrix.md"]
);

add(
  "SIGN-IN-WITH-APPLE",
  "na",
  "V1 account authentication is email/password; Google is a post-login Calendar connector, so App Review 4.8 is not triggered by another social login.",
  ["docs/architecture/sign-in-with-apple-decision.md"]
);

const summary = {
  passed: results.filter((result) => result.status === STATUS.pass).length,
  failed: results.filter((result) => result.status === STATUS.fail).length,
  blocked: results.filter((result) => result.status === STATUS.blocked).length,
  notApplicable: results.filter((result) => result.status === STATUS.na).length,
};

if (writeEvidence) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        commit: (() => {
          try {
            return execFileSync("git", ["rev-parse", "HEAD"], {
              cwd: root,
              encoding: "utf8",
            }).trim();
          } catch {
            return null;
          }
        })(),
        workingTreeDirty: (() => {
          try {
            return Boolean(
              execFileSync("git", ["status", "--porcelain=v1"], {
                cwd: root,
                encoding: "utf8",
              }).trim()
            );
          } catch {
            return null;
          }
        })(),
        summary,
        results,
      },
      null,
      2
    )}\n`
  );
}

for (const result of results) {
  process.stdout.write(`${result.status} [${result.id}] ${result.detail}\n`);
}
process.stdout.write(
  `\nSummary: ${summary.passed} pass, ${summary.failed} fail, ${summary.blocked} blocked, ${summary.notApplicable} not applicable.\n`
);
if (writeEvidence) process.stdout.write(`Evidence: ${relative(root, evidencePath)}\n`);

if (summary.failed > 0) process.exitCode = 1;
else if (summary.blocked > 0 && !allowExternalBlockers) process.exitCode = 2;
