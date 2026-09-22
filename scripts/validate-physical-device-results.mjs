import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const inputPath = valueAfter("--input");
const evidenceArg =
  valueAfter("--evidence") ||
  "docs/launch-readiness/evidence/05-health-and-healthkit/physical-iphone-test.json";
if (!inputPath) fail("--input is required; do not validate the blank template as evidence");
const required = readJson("config/testing/physical-device-scenarios.json").scenarios;
const input = JSON.parse(readFileSync(path.resolve(inputPath), "utf8"));
const errors = [];

if (input.schemaVersion !== 1) errors.push("schemaVersion must be 1");
const candidate = input.candidate ?? {};
requiredString(candidate.buildNumber, "candidate.buildNumber");
if (!/^[0-9a-f]{40}$/i.test(candidate.commit ?? ""))
  errors.push("candidate.commit must be the exact 40-character Git commit");
if (candidate.bundleId !== "app.daybreak.mobile")
  errors.push("candidate.bundleId must be app.daybreak.mobile");
if (!/^[0-9a-f]{64}$/i.test(candidate.ipaSha256 ?? ""))
  errors.push("candidate.ipaSha256 must be the exact SHA-256");
requiredString(candidate.codemagicBuildId, "candidate.codemagicBuildId");
if (!["testflight", "ad_hoc", "app_store"].includes(candidate.installationType))
  errors.push("candidate.installationType must identify a signed distribution install");

const execution = input.execution ?? {};
for (const key of [
  "deviceModel",
  "iosVersion",
  "testAccountReference",
  "testerReference",
  "startedAt",
  "completedAt",
]) {
  requiredString(execution[key], `execution.${key}`);
}
if (/@/.test(execution.testAccountReference ?? ""))
  errors.push("execution.testAccountReference must be a non-email fixture reference");
if (/@/.test(execution.testerReference ?? ""))
  errors.push(
    "execution.testerReference must be a non-email role or controlled identity reference"
  );
for (const key of ["startedAt", "completedAt"]) {
  if (execution[key] && Number.isNaN(Date.parse(execution[key])))
    errors.push(`execution.${key} must be an ISO timestamp`);
}
if (
  execution.startedAt &&
  execution.completedAt &&
  Date.parse(execution.completedAt) < Date.parse(execution.startedAt)
) {
  errors.push("execution.completedAt precedes startedAt");
}

const supplied = Array.isArray(input.results) ? input.results : [];
const byId = new Map();
for (const result of supplied) {
  if (!result || typeof result.id !== "string") {
    errors.push("every result requires an id");
    continue;
  }
  if (byId.has(result.id)) errors.push(`duplicate result ${result.id}`);
  byId.set(result.id, result);
}
const requiredIds = new Set(required.map((scenario) => scenario.id));
for (const id of byId.keys()) if (!requiredIds.has(id)) errors.push(`unexpected scenario ${id}`);

const sanitizedResults = [];
for (const scenario of required) {
  const result = byId.get(scenario.id);
  if (!result) {
    errors.push(`missing result ${scenario.id}`);
    continue;
  }
  if (!["pass", "fail", "not_applicable"].includes(result.result))
    errors.push(`${scenario.id}.result must be pass, fail, or not_applicable`);
  if (result.result === "not_applicable" && scenario.notApplicableAllowed !== true)
    errors.push(`${scenario.id} cannot be marked not_applicable`);
  requiredString(result.evidence, `${scenario.id}.evidence`);
  requiredString(result.notes, `${scenario.id}.notes`);
  sanitizedText(result.evidence, `${scenario.id}.evidence`);
  sanitizedText(result.notes, `${scenario.id}.notes`);
  if (result.defectLink !== null) sanitizedText(result.defectLink, `${scenario.id}.defectLink`);
  if (result.result === "not_applicable" && String(result.notes ?? "").length < 20)
    errors.push(`${scenario.id}.notes must give a specific not-applicable rationale`);
  if (result.result === "fail" && !nonempty(result.defectLink))
    errors.push(`${scenario.id}.defectLink is required for a failure`);
  if (result.result !== "fail" && result.defectLink !== null)
    errors.push(`${scenario.id}.defectLink must be null unless the result failed`);
  if (!["not_required", "pass", "fail"].includes(result.retestResult))
    errors.push(`${scenario.id}.retestResult is invalid`);
  if (result.result === "fail" && result.retestResult === "not_required")
    errors.push(`${scenario.id}.retestResult cannot be not_required after a failure`);
  sanitizedResults.push({
    id: scenario.id,
    category: scenario.category,
    scenario: scenario.name,
    result: result.result,
    evidence: result.evidence,
    notes: result.notes,
    defectLink: result.defectLink,
    retestResult: result.retestResult,
  });
}

const unresolvedFailures = sanitizedResults.filter(
  (item) => item.result === "fail" && item.retestResult !== "pass"
);
if (unresolvedFailures.length)
  errors.push(
    `unresolved failed scenarios: ${unresolvedFailures.map((item) => item.id).join(", ")}`
  );
if (errors.length) {
  console.error(
    `Physical-device matrix is incomplete or invalid (${errors.length} issue${errors.length === 1 ? "" : "s"}):`
  );
  for (const error of errors) console.error(`- ${error}`);
  process.exit(2);
}

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: "pass",
  candidate,
  execution,
  summary: {
    total: sanitizedResults.length,
    passed: sanitizedResults.filter((item) => item.result === "pass").length,
    notApplicable: sanitizedResults.filter((item) => item.result === "not_applicable").length,
    failed: 0,
  },
  results: sanitizedResults,
  attestation:
    "This record validates owner/QA-supplied physical-device results; it is not simulator or repository-only evidence.",
};
const output = safeEvidencePath(evidenceArg);
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(
  `Physical-device matrix complete: ${evidence.summary.passed} pass, ${evidence.summary.notApplicable} not applicable.`
);
console.log(`Sanitized physical-device evidence written: ${output}`);

function readJson(relative) {
  return JSON.parse(readFileSync(path.resolve(relative), "utf8"));
}
function requiredString(value, name) {
  if (!nonempty(value)) errors.push(`${name} is required`);
}
function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function sanitizedText(value, name) {
  if (typeof value !== "string") return;
  const forbidden = [
    /[^\s@]+@[^\s@]+\.[^\s@]+/,
    /\bBearer\s+[A-Za-z0-9._~-]+/i,
    /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/,
    /\b(?:access_token|refresh_token|password|secret|api_key)\s*[:=]\s*\S+/i,
    /\b(?:heart\s*rate|hrv|weight|sleep\s*score|blood\s*oxygen)\s*[:=]\s*\d/i,
  ];
  if (forbidden.some((pattern) => pattern.test(value))) {
    errors.push(`${name} appears to contain identity, credential, or raw health data`);
  }
}
function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}
function safeEvidencePath(candidatePath) {
  const output = path.resolve(candidatePath);
  const root = path.resolve("docs/launch-readiness/evidence");
  if (!output.startsWith(`${root}${path.sep}`))
    fail("evidence must stay under docs/launch-readiness/evidence");
  return output;
}
function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
