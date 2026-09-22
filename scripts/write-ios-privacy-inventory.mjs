import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const archiveArg = valueAfter("--archive") || process.env.ARCHIVE_PATH;
const outputArg = valueAfter("--output") || process.env.PRIVACY_EVIDENCE_OUTPUT;
if (!archiveArg || !outputArg) fail("--archive and --output are required");

const archive = path.resolve(archiveArg);
if (!existsSync(archive) || !statSync(archive).isDirectory()) fail("archive does not exist");
const output = safeEvidencePath(outputArg);

const manifestPaths = walk(archive).filter(
  (file) => path.basename(file) === "PrivacyInfo.xcprivacy"
);
if (manifestPaths.length === 0) fail("no PrivacyInfo.xcprivacy files were found in the archive");

const manifests = manifestPaths.map((file) => {
  const parsed = plistJson(file);
  return {
    archiveRelativePath: path.relative(archive, file).replaceAll(path.sep, "/"),
    sha256: sha256(file),
    tracking: parsed.NSPrivacyTracking === true,
    trackingDomainCount: array(parsed.NSPrivacyTrackingDomains).length,
    collectedDataTypes: array(parsed.NSPrivacyCollectedDataTypes)
      .map((item) => item.NSPrivacyCollectedDataType)
      .filter(Boolean)
      .sort(),
    accessedApiTypes: array(parsed.NSPrivacyAccessedAPITypes)
      .map((item) => ({
        category: item.NSPrivacyAccessedAPIType,
        reasons: array(item.NSPrivacyAccessedAPITypeReasons).sort(),
      }))
      .sort((a, b) => String(a.category).localeCompare(String(b.category))),
  };
});

const appManifest = manifests.find((item) =>
  /^Products\/Applications\/[^/]+\.app\/PrivacyInfo\.xcprivacy$/.test(item.archiveRelativePath)
);
if (!appManifest) fail("the archived app target has no root privacy manifest");

const frameworkNames = walkDirectories(path.join(archive, "Products", "Applications"))
  .filter((directory) => directory.endsWith(".framework"))
  .map((directory) => path.basename(directory, ".framework"))
  .sort();

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: process.env.CM_COMMIT || process.env.GITHUB_SHA || null,
  codemagicBuildId: process.env.CM_BUILD_ID || null,
  status: "archive-manifest-inventory-pass",
  manifests,
  aggregate: {
    trackingDeclared: manifests.some((item) => item.tracking),
    trackingDomainCount: manifests.reduce((sum, item) => sum + item.trackingDomainCount, 0),
    collectedDataTypes: [...new Set(manifests.flatMap((item) => item.collectedDataTypes))].sort(),
    accessedApiTypes: [
      ...new Map(
        manifests
          .flatMap((item) => item.accessedApiTypes)
          .map((item) => [`${item.category}:${item.reasons.join(",")}`, item])
      ).values(),
    ],
  },
  archivedFrameworkNames: frameworkNames,
  xcodeOrganizerAggregatePrivacyReport: {
    status: "external-macos-ui-required",
    reason:
      "Apple documents aggregate privacy-report generation in Xcode Organizer; the retained signed archive must be opened by the owner and the report exported there.",
    runbook: "docs/app-store/xcode-privacy-report-runbook.md",
  },
  sanitized: true,
};

mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Sanitized archive privacy inventory written: ${output}`);

function plistJson(file) {
  try {
    return JSON.parse(
      execFileSync("plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" })
    );
  } catch {
    fail(`could not parse privacy manifest ${path.basename(file)}`);
  }
}

function walk(root) {
  if (!existsSync(root)) return [];
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...walk(target));
    else if (entry.isFile()) found.push(target);
  }
  return found;
}

function walkDirectories(root) {
  if (!existsSync(root)) return [];
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(root, entry.name);
    found.push(target, ...walkDirectories(target));
  }
  return found;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function safeEvidencePath(candidate) {
  const outputPath = path.resolve(candidate);
  const root = path.resolve("build/release-evidence");
  if (!outputPath.startsWith(`${root}${path.sep}`))
    fail("output must stay under build/release-evidence");
  return outputPath;
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
