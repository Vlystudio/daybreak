import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const entitlementsPath = required("--entitlements");
const profilePath = required("--profile");
const outputPath = safeOutput(required("--output"));
const expectedBundle = required("--bundle-id");
const expectedTeam = required("--team-id");

const entitlements = JSON.parse(readFileSync(entitlementsPath, "utf8"));
const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const allowedEntitlements = new Set([
  "application-identifier",
  "beta-reports-active",
  "com.apple.developer.healthkit",
  "com.apple.developer.team-identifier",
  "get-task-allow",
  "keychain-access-groups",
]);
const keys = Object.keys(entitlements).sort();
const unexpected = keys.filter((key) => !allowedEntitlements.has(key));
if (unexpected.length) fail(`unexpected signed entitlements: ${unexpected.join(", ")}`);
if (entitlements["com.apple.developer.healthkit"] !== true)
  fail("HealthKit signed entitlement is not true");
if (entitlements["get-task-allow"] === true) fail("release archive has get-task-allow=true");
if (entitlements["com.apple.developer.team-identifier"] !== expectedTeam)
  fail("signed team identifier mismatch");
if (entitlements["application-identifier"] !== `${expectedTeam}.${expectedBundle}`)
  fail("signed application identifier mismatch");

const profileEntitlements = profile.Entitlements ?? {};
if (profile.TeamIdentifier?.[0] !== expectedTeam) fail("profile team identifier mismatch");
if (profileEntitlements["application-identifier"] !== `${expectedTeam}.${expectedBundle}`)
  fail("profile application identifier mismatch");
if (profileEntitlements["com.apple.developer.healthkit"] !== true)
  fail("profile HealthKit entitlement is not true");
if (profileEntitlements["get-task-allow"] === true)
  fail("distribution profile has get-task-allow=true");
const expiration = new Date(profile.ExpirationDate);
if (!Number.isFinite(expiration.getTime()) || expiration <= new Date())
  fail("profile is expired or has no valid expiration");

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: process.env.CM_COMMIT || null,
  codemagicBuildId: process.env.CM_BUILD_ID || null,
  status: "pass",
  bundleId: expectedBundle,
  signedEntitlementKeys: keys,
  expectedEntitlements: {
    healthKit: true,
    developmentDebuggingDisabled: true,
    teamAndApplicationIdentifiersMatch: true,
    unexpectedEntitlementsAbsent: true,
  },
  provisioningProfile: {
    name: profile.Name ?? null,
    expiration: expiration.toISOString(),
    teamMatches: true,
    applicationIdentifierMatches: true,
    healthKitEnabled: true,
    developmentDebuggingDisabled: true,
  },
  sanitized: true,
};
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(`Sanitized signing evidence written: ${outputPath}`);

function required(flag) {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value) fail(`${flag} is required`);
  return value;
}

function safeOutput(candidate) {
  const output = path.resolve(candidate);
  const root = path.resolve("build/release-evidence");
  if (!output.startsWith(`${root}${path.sep}`))
    fail("output must stay under build/release-evidence");
  return output;
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
