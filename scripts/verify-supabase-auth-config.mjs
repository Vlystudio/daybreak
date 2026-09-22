import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const args = process.argv.slice(2);

function fail(message) {
  console.error(`Supabase Auth configuration verification stopped: ${message}`);
  process.exit(1);
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")
    ? args[index + 1]
    : null;
}

const allowed = new Set(["--input", "--evidence"]);
for (let i = 0; i < args.length; i += 1) {
  if (!allowed.has(args[i])) fail(`unknown argument ${args[i]}.`);
  if (!args[i + 1] || args[i + 1].startsWith("--")) fail(`${args[i]} requires a value.`);
  i += 1;
}
const inputPath = valueAfter("--input");
const evidencePath = valueAfter("--evidence");
if (!inputPath || !evidencePath) fail("both --input and --evidence are required.");
if (!existsSync(inputPath)) fail(`input does not exist: ${inputPath}.`);

let config;
try {
  config = JSON.parse(readFileSync(inputPath, "utf8"));
} catch {
  fail("input is not valid JSON.");
}
const serialized = JSON.stringify(config);
if (
  /(?:service_role|(?:access|refresh)[_-]?token[_-]?(?:value|key|ciphertext)|password[_-]?value|secret[_-]?value|bearer\s+|eyJ[A-Za-z0-9_-]+\.)/i.test(
    serialized
  )
) {
  fail(
    "input appears to contain a credential or secret-bearing field; use only sanitized settings."
  );
}

const source = (file) => readFileSync(path.join(root, file), "utf8");
const repositoryChecks = [
  {
    id: "password-client-minimum",
    pass: /password:\s*z\.string\(\)\.min\(12/.test(source("src/lib/validation.ts")),
    detail: "Signup enforces a 12-character minimum.",
  },
  {
    id: "recovery-flow",
    pass:
      /resetPasswordForEmail/.test(source("src/actions/auth.ts")) &&
      /\/auth\/callback\?next=\/account\/update-password/.test(source("src/actions/auth.ts")),
    detail: "Recovery uses the fixed application callback.",
  },
  {
    id: "aal-enforcement",
    pass:
      /getAuthenticatorAssuranceLevel/.test(source("src/proxy.ts")) &&
      /requiresMfaChallenge/.test(source("src/lib/auth.ts")),
    detail: "Request and server-action gates enforce AAL2 for enrolled users.",
  },
  {
    id: "global-session-revocation",
    pass: /signOut\(\{\s*scope:\s*["']global["']\s*\}\)/.test(source("src/actions/auth.ts")),
    detail: "Global logout is implemented server-side.",
  },
  {
    id: "adult-legal-auth-trigger",
    pass:
      /current explicit adult attestation and legal acceptance are required/.test(
        source("supabase/migrations/0049_adult_eligibility_and_legal_acceptance.sql")
      ) && /after insert on auth\.users/.test(source("supabase/migrations/0001_init.sql")),
    detail: "Auth creation is transactionally bound to adult/legal metadata.",
  },
  {
    id: "durable-auth-deletion",
    pass:
      /admin\.deleteUser\(userId\)/.test(source("src/lib/account-deletion.ts")) &&
      /authentication account and sessions/.test(source("src/lib/account-deletion.ts")),
    detail: "Auth/session deletion is the final durable deletion step.",
  },
];

const dashboardChecks = [];
const check = (id, pass, detail) => dashboardChecks.push({ id, pass, detail });
check("schema", config.schemaVersion === 1, "Evidence uses schema version 1.");
check(
  "environment",
  config.environment === "production",
  "Evidence is explicitly production-scoped."
);
check(
  "identity",
  typeof config.projectRefFingerprint === "string" &&
    /^[a-f0-9]{12,64}$/i.test(config.projectRefFingerprint),
  "An irreversible production project fingerprint is present."
);
check(
  "reviewer",
  typeof config.reviewer === "string" && config.reviewer.trim().length >= 2,
  "Reviewer is named."
);
check("review-date", !Number.isNaN(Date.parse(config.reviewedAt)), "Review date is valid.");
check(
  "evidence-references",
  Array.isArray(config.evidenceReferences) && config.evidenceReferences.length > 0,
  "Non-secret dashboard or staging evidence references are supplied."
);
check(
  "email-confirmation",
  config.email?.confirmationRequired === true,
  "Email confirmation is required."
);
check(
  "secure-email-change",
  config.email?.secureEmailChange === true,
  "Secure email change is enabled."
);
check(
  "password-policy",
  Number.isInteger(config.password?.minimumLength) && config.password.minimumLength >= 12,
  "Provider password minimum is at least 12."
);
check(
  "leaked-password-protection",
  config.password?.leakedPasswordProtection === true,
  "Leaked-password protection is enabled."
);
check(
  "password-recovery",
  config.recovery?.enabled === true &&
    config.recovery?.singleUseVerified === true &&
    Number.isInteger(config.recovery?.expirySeconds) &&
    config.recovery.expirySeconds > 0 &&
    config.recovery.expirySeconds <= 3600,
  "Recovery is enabled, single-use, and expires within one hour."
);
check(
  "session-lifetime",
  Number.isInteger(config.sessions?.jwtExpirySeconds) &&
    config.sessions.jwtExpirySeconds >= 300 &&
    config.sessions.jwtExpirySeconds <= 3600 &&
    Number.isInteger(config.sessions?.inactivityTimeoutSeconds) &&
    config.sessions.inactivityTimeoutSeconds > 0 &&
    Number.isInteger(config.sessions?.maximumLifetimeSeconds) &&
    config.sessions.maximumLifetimeSeconds >= config.sessions.inactivityTimeoutSeconds,
  "JWT, inactivity, and maximum lifetime values are bounded."
);
check(
  "refresh-token-rotation",
  config.refreshTokens?.rotationEnabled === true &&
    config.refreshTokens?.reuseDetectionEnabled === true &&
    Number.isInteger(config.refreshTokens?.reuseIntervalSeconds) &&
    config.refreshTokens.reuseIntervalSeconds >= 0 &&
    config.refreshTokens.reuseIntervalSeconds <= 30,
  "Refresh rotation and reuse detection are enabled with a narrow interval."
);
check(
  "provider-rate-limits",
  [
    config.rateLimits?.signupsPerHour,
    config.rateLimits?.tokenRequestsPerFiveMinutes,
    config.rateLimits?.recoveryRequestsPerHour,
  ].every((value) => Number.isInteger(value) && value > 0),
  "Supabase signup, token, and recovery limits are recorded."
);
let siteUrl = null;
let redirects = [];
try {
  siteUrl = new URL(config.urls?.siteUrl);
  redirects = (config.urls?.redirectAllowlist ?? []).map((url) => new URL(url));
} catch {
  // Failed below without preserving invalid URL text in evidence.
}
check(
  "site-url",
  siteUrl?.protocol === "https:" && siteUrl.hostname === "daybreak-one.vercel.app",
  "Site URL is the reviewed HTTPS production origin."
);
check(
  "redirect-allowlist",
  redirects.length > 0 &&
    redirects.every(
      (url) =>
        url.protocol === "https:" &&
        url.hostname === "daybreak-one.vercel.app" &&
        !url.href.includes("*") &&
        !url.hostname.includes("localhost")
    ) &&
    redirects.some((url) => url.pathname === "/auth/callback"),
  "Redirects contain the fixed callback and no wildcard or local host."
);
check(
  "oauth-login-providers",
  Array.isArray(config.oauth?.accountProviders) &&
    config.oauth.accountProviders.length === 0 &&
    config.oauth?.connectorsAreNotLoginProviders === true,
  "V1 account login is email/password; calendar/wearable OAuth remains post-login."
);
check(
  "abuse-controls",
  config.abuseControls?.captchaEnabled === true ||
    config.abuseControls?.edgeOrWafRateLimiting === true,
  "CAPTCHA or an approved edge/WAF abuse control is active."
);
check(
  "mfa-totp-aal",
  config.mfa?.totpEnabled === true &&
    config.mfa?.aalEnforcementVerified === true &&
    typeof config.mfa?.stagingEvidenceReference === "string" &&
    config.mfa.stagingEvidenceReference.length > 0,
  "TOTP and staged AAL enforcement are evidenced."
);
check(
  "sign-in-with-apple",
  config.signInWithApple?.applicable === false &&
    config.signInWithApple?.configured === false &&
    typeof config.signInWithApple?.rationale === "string" &&
    config.signInWithApple.rationale.length > 20,
  "Sign in with Apple is documented as not applicable to email/password-only V1."
);
check(
  "auth-hooks",
  config.hooks?.adultLegalTriggerVerified === true &&
    config.hooks?.failedTriggerRollsBackAuthUser === true,
  "The adult/legal trigger and rollback behavior were staged."
);
check(
  "account-deletion",
  config.accountDeletion?.globalLogoutVerified === true &&
    config.accountDeletion?.authDeletionVerified === true &&
    typeof config.accountDeletion?.stagingEvidenceReference === "string" &&
    config.accountDeletion.stagingEvidenceReference.length > 0,
  "Global logout and Auth deletion compatibility are staged."
);

const failedRepository = repositoryChecks.filter(({ pass }) => !pass);
const incompleteDashboard = dashboardChecks.filter(({ pass }) => !pass);
const status =
  failedRepository.length > 0 ? "fail" : incompleteDashboard.length > 0 ? "blocked" : "pass";
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status,
  sourceFingerprint: createHash("sha256").update(serialized).digest("hex"),
  repositoryChecks,
  dashboardChecks,
  summary: {
    repositoryFailures: failedRepository.map(({ id }) => id),
    dashboardItemsRequiringEvidence: incompleteDashboard.map(({ id }) => id),
  },
  sanitization: {
    credentialsAccepted: false,
    credentialValuesStored: false,
    rawProjectReferenceStored: false,
  },
};
const resolvedEvidence = path.resolve(root, evidencePath);
mkdirSync(path.dirname(resolvedEvidence), { recursive: true });
writeFileSync(resolvedEvidence, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(
  `Auth configuration: ${status}; ${repositoryChecks.length - failedRepository.length}/${repositoryChecks.length} repository checks and ${dashboardChecks.length - incompleteDashboard.length}/${dashboardChecks.length} supplied-setting checks passed.`
);
console.log(`Sanitized evidence: ${path.relative(root, resolvedEvidence)}`);
if (status === "fail") process.exitCode = 1;
if (status === "blocked") process.exitCode = 2;
