import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const required = [
  "IOS_EVIDENCE_OUTPUT",
  "IOS_EVIDENCE_COMMIT",
  "IOS_EVIDENCE_WORKFLOW",
  "IOS_EVIDENCE_ARCHIVE_PATH",
  "IOS_EVIDENCE_IPA_PATH",
  "IOS_EVIDENCE_DSYM_PATH",
  "IOS_EVIDENCE_IPA_SHA256",
  "IOS_EVIDENCE_BUNDLE_ID",
  "IOS_EVIDENCE_VERSION",
  "IOS_EVIDENCE_BUILD_NUMBER",
  "IOS_EVIDENCE_SIGNING_TEAM",
  "IOS_EVIDENCE_SIGNING_IDENTITY",
  "IOS_EVIDENCE_PROFILE_NAME",
  "IOS_EVIDENCE_PROFILE_EXPIRATION",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing safe archive evidence value: ${name}`);
}

const ipaBytes = readFileSync(process.env.IOS_EVIDENCE_IPA_PATH);
const computedHash = createHash("sha256").update(ipaBytes).digest("hex");
if (computedHash !== process.env.IOS_EVIDENCE_IPA_SHA256) {
  throw new Error("IPA checksum changed while writing evidence");
}

const archiveStat = statSync(process.env.IOS_EVIDENCE_ARCHIVE_PATH);
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: process.env.IOS_EVIDENCE_COMMIT,
  codemagicBuildId: process.env.IOS_EVIDENCE_BUILD_ID || null,
  workflow: process.env.IOS_EVIDENCE_WORKFLOW,
  archive: {
    path: process.env.IOS_EVIDENCE_ARCHIVE_PATH,
    modifiedAt: archiveStat.mtime.toISOString(),
  },
  ipa: {
    path: process.env.IOS_EVIDENCE_IPA_PATH,
    sha256: computedHash,
  },
  dSYM: { path: process.env.IOS_EVIDENCE_DSYM_PATH },
  application: {
    bundleId: process.env.IOS_EVIDENCE_BUNDLE_ID,
    version: process.env.IOS_EVIDENCE_VERSION,
    buildNumber: process.env.IOS_EVIDENCE_BUILD_NUMBER,
  },
  signing: {
    team: process.env.IOS_EVIDENCE_SIGNING_TEAM,
    identity: process.env.IOS_EVIDENCE_SIGNING_IDENTITY,
    provisioningProfile: process.env.IOS_EVIDENCE_PROFILE_NAME,
    provisioningProfileExpiration: process.env.IOS_EVIDENCE_PROFILE_EXPIRATION,
  },
  verified: {
    codeSignature: true,
    embeddedProvisioningProfile: true,
    entitlements: true,
    healthKitEntitlement: true,
    privacyManifestInArchive: true,
    bundleIdentifier: true,
    versionAndBuildNumber: true,
    appTransportSecurity: true,
    iconDeclaration: true,
    launchScreenDeclaration: true,
    dSYMExists: true,
  },
  notVerifiedByThisArtifact: [
    "Xcode Organizer privacy report",
    "App Store Connect upload and processing",
    "TestFlight installation",
    "physical-device behavior",
  ],
};

const output = path.resolve(process.env.IOS_EVIDENCE_OUTPUT);
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`Sanitized archive evidence written: ${output}`);
