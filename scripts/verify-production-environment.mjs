import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const EXPECTED_APP_URL = "https://daybreak-one.vercel.app";
const EXPECTED_SUPABASE_URL = "https://cybpuscssilbguypptxi.supabase.co";
const EXPECTED_SUPABASE_REF = "cybpuscssilbguypptxi";
const DEFAULT_EVIDENCE = "build/release-evidence/production-environment.sanitized.json";

const processors = readJson("config/privacy/processors.json").processors;
const aiProviders = readJson("config/privacy/ai-providers.json").providers;
const legal = readJson("config/legal/legal-requirements.json");

const coreSecrets = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  "ADMIN_ACTION_SECRET",
];

const processorEnvironmentRequirements = {
  sentry: ["NEXT_PUBLIC_SENTRY_DSN"],
  resend: ["RESEND_API_KEY", "EMAIL_FROM"],
  web_push: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  oura: ["OURA_CLIENT_ID", "OURA_CLIENT_SECRET"],
  fitbit: ["FITBIT_CLIENT_ID", "FITBIT_CLIENT_SECRET"],
  weatherapi: ["WEATHER_API_KEY"],
  spoonacular: ["SPOONACULAR_API_KEY"],
  grocerytracker: ["GROCERYTRACKER_URL", "GROCERYTRACKER_ANON_KEY"],
};

const aiEnvironmentRequirements = {
  openai: ["OPENAI_API_KEY"],
  logmeal: ["LOGMEAL_API_KEY"],
};

const args = new Set(process.argv.slice(2));
const evidenceArg = process.argv.indexOf("--evidence");
const evidencePath = evidenceArg >= 0 ? process.argv[evidenceArg + 1] : DEFAULT_EVIDENCE;
if (evidenceArg >= 0 && !evidencePath) fail("--evidence requires a path");

const checks = [];
function check(id, ok, detail) {
  checks.push({ id, status: ok ? "pass" : "blocked", detail });
}

check(
  "app-url",
  process.env.NEXT_PUBLIC_APP_URL === EXPECTED_APP_URL,
  process.env.NEXT_PUBLIC_APP_URL
    ? "Production app URL must match the reviewed native-shell origin."
    : "NEXT_PUBLIC_APP_URL is missing."
);
check(
  "supabase-url",
  process.env.NEXT_PUBLIC_SUPABASE_URL === EXPECTED_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `Supabase URL must identify reviewed project ${EXPECTED_SUPABASE_REF}.`
    : "NEXT_PUBLIC_SUPABASE_URL is missing."
);

for (const name of [...coreSecrets, ...legal.requiredProductionEnvironment]) {
  check(`env:${name}`, present(name), `${name} must be non-placeholder production configuration.`);
}

if (present("TOKEN_ENCRYPTION_KEY")) {
  const bytes = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
  check(
    "token-encryption-key-shape",
    bytes.length === 32 &&
      bytes.toString("base64").replace(/=+$/, "") ===
        process.env.TOKEN_ENCRYPTION_KEY.replace(/=+$/, ""),
    "TOKEN_ENCRYPTION_KEY must be exactly 32 base64-encoded bytes."
  );
}
if (present("CRON_SECRET")) {
  check(
    "cron-secret-shape",
    process.env.CRON_SECRET.length >= 32,
    "CRON_SECRET must contain at least 32 characters."
  );
}
if (present("ADMIN_ACTION_SECRET")) {
  check(
    "admin-action-secret-shape",
    process.env.ADMIN_ACTION_SECRET.length >= 32 &&
      process.env.ADMIN_ACTION_SECRET !== process.env.CRON_SECRET,
    "ADMIN_ACTION_SECRET must contain at least 32 characters and must not reuse CRON_SECRET."
  );
}

for (const name of legal.requiredProductionEnvironment) {
  if (!present(name)) continue;
  const value = process.env[name];
  if (name.endsWith("_URL")) {
    check(`legal-url:${name}`, isHttps(value), `${name} must be an HTTPS URL.`);
  } else if (name.endsWith("_EMAIL")) {
    check(
      `legal-email:${name}`,
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      `${name} must be a valid public mailbox.`
    );
  } else if (name.endsWith("_DATE")) {
    check(
      `legal-date:${name}`,
      /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      `${name} must be an ISO calendar date.`
    );
  }
}

for (const processor of processors) {
  const approved =
    processor.enabledEnvironments.includes("production") &&
    processor.approvalStatus === "approved" &&
    assigned(processor.owner) &&
    presentValue(processor.evidence) &&
    validReviewDate(processor.securityReviewDate);
  check(
    `processor:${processor.id}`,
    approved,
    "Production processors require approved status, production enablement, an assigned owner, evidence, and a valid security review date."
  );
  if (approved) {
    for (const name of processorEnvironmentRequirements[processor.id] ?? []) {
      check(
        `processor-env:${processor.id}:${name}`,
        present(name),
        `${name} is required by approved processor ${processor.id}.`
      );
    }
  }
}

for (const provider of aiProviders) {
  const approved =
    provider.enabledEnvironments.includes("production") &&
    provider.approvalStatus === "approved" &&
    provider.emergencyDisabled === false &&
    assigned(provider.owner) &&
    validReviewDate(provider.securityReviewDate) &&
    validFutureDate(provider.reviewExpiresAt);
  check(
    `ai-provider:${provider.id}`,
    approved,
    "AI providers require production approval, production enablement, an assigned owner, current review dates, and emergency-disable=false."
  );
  if (approved) {
    for (const name of aiEnvironmentRequirements[provider.id] ?? []) {
      check(
        `ai-env:${provider.id}:${name}`,
        present(name),
        `${name} is required by approved AI provider ${provider.id}.`
      );
    }
  }
}

const failed = checks.filter((item) => item.status !== "pass");
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: safeCommit(),
  workingTreeDirty: safeWorkingTreeDirty(),
  expected: {
    appOrigin: EXPECTED_APP_URL,
    supabaseProjectRef: EXPECTED_SUPABASE_REF,
  },
  status: failed.length === 0 ? "pass" : "blocked",
  summary: { passed: checks.length - failed.length, blocked: failed.length, total: checks.length },
  checks,
  secrecy: "Only setting names and validation outcomes are recorded; values are never written.",
};

if (!args.has("--no-write-evidence")) {
  const output = safeEvidencePath(evidencePath);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`Sanitized production-environment evidence written: ${output}`);
}
console.log(
  `Production environment: ${evidence.status}; ${evidence.summary.passed}/${evidence.summary.total} checks passed.`
);
if (failed.length) {
  for (const item of failed) console.error(`BLOCKED ${item.id}: ${item.detail}`);
  process.exitCode = 2;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.resolve(relativePath), "utf8"));
}

function present(name) {
  return presentValue(process.env[name]) && !placeholder(process.env[name]);
}

function presentValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function placeholder(value) {
  return /(?:placeholder|replace|change[-_ ]?me|example\.(?:com|org|test)|your[-_ ]|unassigned|tbd|todo)/i.test(
    value ?? ""
  );
}

function assigned(value) {
  return presentValue(value) && !placeholder(value) && !/release blocker/i.test(value);
}

function validReviewDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function validFutureDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const timestamp = Date.parse(`${value}T23:59:59Z`);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function safeEvidencePath(candidate) {
  const output = path.resolve(candidate);
  const buildRoot = path.resolve("build/release-evidence");
  const reviewedRoot = path.resolve("docs/launch-readiness/evidence");
  if (
    !output.startsWith(`${buildRoot}${path.sep}`) &&
    !output.startsWith(`${reviewedRoot}${path.sep}`)
  ) {
    fail(
      "Evidence output must stay under build/release-evidence or docs/launch-readiness/evidence"
    );
  }
  return output;
}

function safeCommit() {
  if (process.env.CM_COMMIT || process.env.GITHUB_SHA) {
    return process.env.CM_COMMIT || process.env.GITHUB_SHA;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function safeWorkingTreeDirty() {
  try {
    return Boolean(execFileSync("git", ["status", "--porcelain=v1"], { encoding: "utf8" }).trim());
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
