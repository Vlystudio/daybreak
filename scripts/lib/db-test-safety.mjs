import { createHash } from "node:crypto";

export const PRODUCTION_PROJECT_REF = "cybpuscssilbguypptxi";
export const PRODUCTION_APP_ORIGIN = "https://daybreak-one.vercel.app";
export const TEST_MARKER_SETTING = "daybreak.isolated_test_environment";
export const PRODUCTION_MARKER_SETTING = "daybreak.production_environment";
export const DESTRUCTIVE_ACKNOWLEDGEMENT =
  "I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_DISPOSABLE_TEST_DATABASE";
export const CREDENTIAL_APPROVAL =
  "I_APPROVE_THIS_CREDENTIAL_FOR_ISOLATED_DESTRUCTIVE_DATABASE_TESTS";

export const SYNTHETIC_AUTH_USERS = new Map([
  ["10000000-0000-0000-0000-000000000001", "alice.rls-test@example.invalid"],
  ["20000000-0000-0000-0000-000000000002", "bob.rls-test@example.invalid"],
  ["30000000-0000-0000-0000-000000000003", "no-attestation@example.invalid"],
  ["31000000-0000-0000-0000-000000000031", "oauth-no-attestation@example.invalid"],
  ["32000000-0000-0000-0000-000000000032", "apple-no-attestation@example.invalid"],
  ["40000000-0000-0000-0000-000000000004", "eligible@example.invalid"],
  ["50000000-0000-0000-0000-000000000005", "deletion@example.invalid"],
  ["60000000-0000-0000-0000-000000000006", "ai-one@example.invalid"],
  ["61000000-0000-0000-0000-000000000061", "alice.surface-test@example.invalid"],
  ["62000000-0000-0000-0000-000000000062", "bob.surface-test@example.invalid"],
  ["70000000-0000-0000-0000-000000000007", "ai-two@example.invalid"],
  ["81000000-0000-0000-0000-000000000081", "rights-one@example.invalid"],
  ["82000000-0000-0000-0000-000000000082", "rights-two@example.invalid"],
  ["91000000-0000-0000-0000-000000000021", "upgrade-0021@example.invalid"],
  ["92000000-0000-0000-0000-000000000050", "upgrade-deletion@example.invalid"],
]);

const ALLOWED_STORAGE_BUCKETS = new Set(["avatars", "launch-upgrade-fixture"]);
const ALLOWED_STORAGE_OBJECTS = new Set([
  "launch-upgrade-fixture/91000000-0000-0000-0000-000000000021/fixture.txt",
]);

function splitList(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function required(environment, name, issues) {
  const value = environment[name]?.trim();
  if (!value) issues.push(`${name} is required.`);
  return value ?? "";
}

function normalizeOrigin(value, issues) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      issues.push("DAYBREAK_DB_TEST_APPLICATION_ORIGIN must be a credential-free origin.");
    }
    if (parsed.protocol !== "https:") {
      issues.push("DAYBREAK_DB_TEST_APPLICATION_ORIGIN must use HTTPS.");
    }
    if (parsed.pathname !== "/") {
      issues.push("DAYBREAK_DB_TEST_APPLICATION_ORIGIN must not include a path.");
    }
    return parsed.origin;
  } catch {
    issues.push("DAYBREAK_DB_TEST_APPLICATION_ORIGIN must be a valid absolute origin.");
    return "";
  }
}

export function projectRefFingerprint(projectRef) {
  return createHash("sha256").update(projectRef).digest("hex").slice(0, 16);
}

export function resolveDatabaseTestOptions(argv, environment = process.env) {
  let cliMode = null;
  let preflightOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--preflight-only") {
      preflightOnly = true;
    } else if (argument === "--mode") {
      cliMode = argv[index + 1] ?? "";
      index += 1;
    } else if (argument.startsWith("--mode=")) {
      cliMode = argument.slice("--mode=".length);
    } else {
      throw new Error(`unsupported database-test argument: ${argument}`);
    }
  }

  const environmentMode = environment.DAYBREAK_DB_TEST_MODE?.trim() || null;
  if (cliMode && environmentMode && cliMode !== environmentMode) {
    throw new Error("the CLI and DAYBREAK_DB_TEST_MODE values conflict");
  }
  const mode = cliMode || environmentMode || "local";
  if (!new Set(["local", "isolated-remote"]).has(mode)) {
    throw new Error("database test mode must be local or isolated-remote");
  }
  return { mode, preflightOnly, explicitlySelected: Boolean(cliMode || environmentMode) };
}

export function validateRemoteEnvironment(environment = process.env) {
  const issues = [];
  const projectRef = required(environment, "DAYBREAK_DB_TEST_PROJECT_REF", issues);
  const expectedRole = required(environment, "DAYBREAK_DB_TEST_EXPECTED_ROLE", issues);
  const applicationOrigin = normalizeOrigin(
    required(environment, "DAYBREAK_DB_TEST_APPLICATION_ORIGIN", issues),
    issues
  );
  const allowedProjectRefs = splitList(
    required(environment, "DAYBREAK_DB_TEST_ALLOWED_PROJECT_REFS", issues)
  );
  const allowedDatabases = splitList(
    required(environment, "DAYBREAK_DB_TEST_ALLOWED_DATABASES", issues)
  );
  const accessToken = required(environment, "SUPABASE_ACCESS_TOKEN", issues);
  const databasePassword = required(environment, "SUPABASE_DB_PASSWORD", issues);

  if (projectRef && !/^[a-z0-9]{20}$/.test(projectRef)) {
    issues.push("DAYBREAK_DB_TEST_PROJECT_REF is not a valid Supabase project reference.");
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    issues.push("the known production Supabase project is unconditionally denied.");
  }
  const additionalProductionRef = environment.DAYBREAK_DB_TEST_PRODUCTION_PROJECT_REF?.trim();
  if (projectRef && additionalProductionRef && projectRef === additionalProductionRef) {
    issues.push("the configured production Supabase project is denied.");
  }
  if (projectRef && !allowedProjectRefs.has(projectRef)) {
    issues.push("the expected project reference is absent from the explicit allowlist.");
  }
  if (applicationOrigin === PRODUCTION_APP_ORIGIN) {
    issues.push("the production application origin is unconditionally denied.");
  }
  if (environment.DAYBREAK_DB_TEST_DESTRUCTIVE_ACK !== DESTRUCTIVE_ACKNOWLEDGEMENT) {
    issues.push("the exact destructive-test acknowledgement is required.");
  }
  if (environment.DAYBREAK_DB_TEST_CREDENTIAL_APPROVAL !== CREDENTIAL_APPROVAL) {
    issues.push("the exact isolated-test credential approval is required.");
  }
  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  return {
    projectRef,
    expectedRole,
    applicationOrigin,
    allowedProjectRefs,
    allowedDatabases,
    accessToken,
    databasePassword,
    fingerprint: projectRefFingerprint(projectRef),
  };
}

export function validateDatabaseMarker(markerValue, observed, config) {
  const issues = [];
  let marker;
  try {
    marker = JSON.parse(markerValue);
  } catch {
    return ["the database-level isolated-test marker is missing or invalid JSON."];
  }

  if (marker.schemaVersion !== 1)
    issues.push("the database marker schema version is not supported.");
  if (marker.environment !== "isolated-remote-test") {
    issues.push(
      "the database marker does not positively identify an isolated remote test environment."
    );
  }
  if (marker.projectRef !== config.projectRef) {
    issues.push("the database marker project reference does not match the linked project.");
  }
  if (marker.applicationOrigin !== config.applicationOrigin) {
    issues.push("the database marker application origin does not match the configured origin.");
  }
  if (marker.production !== false || marker.productionDataPresent !== false) {
    issues.push("the database marker does not explicitly deny production identity and data.");
  }
  if (marker.destructiveTestingAllowed !== true) {
    issues.push("the database marker does not authorize destructive testing.");
  }
  if (
    !Array.isArray(marker.approvedRoles) ||
    !marker.approvedRoles.includes(observed.currentRole)
  ) {
    issues.push("the connected database role is not approved by the database marker.");
  }
  if (
    !Array.isArray(marker.allowedDatabases) ||
    !marker.allowedDatabases.includes(observed.databaseName)
  ) {
    issues.push("the connected database is not allowlisted by the database marker.");
  }
  if (observed.currentRole !== config.expectedRole) {
    issues.push("the connected database role does not match DAYBREAK_DB_TEST_EXPECTED_ROLE.");
  }
  if (!config.allowedDatabases.has(observed.databaseName)) {
    issues.push("the connected database is absent from DAYBREAK_DB_TEST_ALLOWED_DATABASES.");
  }
  const expiresAt = Date.parse(marker.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    issues.push("the database marker is expired or has no valid future expiry.");
  }
  if (marker.expectedInitialAuthUserCount !== 0) {
    issues.push("the database marker must declare a zero-user isolated baseline.");
  }
  if (observed.productionMarker) {
    issues.push("a database-level production marker is present.");
  }
  return issues;
}

export function validateManagedAuthOrigin(siteUrl, config) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.origin !== config.applicationOrigin || parsed.pathname !== "/") {
      return ["the Supabase Auth site URL does not match the approved non-production origin."];
    }
    if (parsed.origin === PRODUCTION_APP_ORIGIN) {
      return ["the Supabase Auth site URL is the unconditionally denied production origin."];
    }
    return [];
  } catch {
    return ["the Supabase Auth site URL is missing or invalid."];
  }
}

export function validateSyntheticState(authUsers, storageBuckets, storageObjects) {
  const issues = [];
  for (const user of authUsers) {
    if (SYNTHETIC_AUTH_USERS.get(user.id) !== user.email) {
      issues.push("the Auth user population is not the exact recognized synthetic fixture set.");
      break;
    }
  }
  for (const bucket of storageBuckets) {
    if (!ALLOWED_STORAGE_BUCKETS.has(bucket.id)) {
      issues.push("an unrecognized Storage bucket is present.");
      break;
    }
  }
  for (const object of storageObjects) {
    const identity = `${object.bucketId}/${object.name}`;
    if (!ALLOWED_STORAGE_OBJECTS.has(identity)) {
      issues.push("an unrecognized Storage object is present.");
      break;
    }
  }
  return issues;
}

export function redactDatabaseDiagnostics(value, config) {
  let redacted = String(value ?? "");
  for (const secret of [config?.accessToken, config?.databasePassword]) {
    if (secret) redacted = redacted.split(secret).join("[REDACTED]");
  }
  redacted = redacted.replace(/postgres(?:ql)?:\/\/[^\s'\"]+/gi, "[REDACTED_DATABASE_URL]");
  if (config?.projectRef) {
    redacted = redacted
      .split(config.projectRef)
      .join(`[test-project:${config.fingerprint ?? projectRefFingerprint(config.projectRef)}]`);
  }
  return redacted.split(PRODUCTION_PROJECT_REF).join("[DENIED_PRODUCTION_PROJECT]");
}
