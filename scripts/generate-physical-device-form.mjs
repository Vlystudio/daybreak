import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const scenarios = JSON.parse(
  readFileSync(path.resolve("config/testing/physical-device-scenarios.json"), "utf8")
).scenarios;
const outputArg =
  valueAfter("--output") || "build/release-evidence/physical-device-results-form.json";
const output = path.resolve(outputArg);
const root = path.resolve("build/release-evidence");
if (!output.startsWith(`${root}${path.sep}`)) fail("output must stay under build/release-evidence");

const form = {
  schemaVersion: 1,
  candidate: {
    buildNumber: "",
    commit: "",
    bundleId: "app.daybreak.mobile",
    ipaSha256: "",
    codemagicBuildId: "",
    installationType: "testflight",
  },
  execution: {
    deviceModel: "",
    iosVersion: "",
    testAccountReference: "",
    testerReference: "",
    startedAt: "",
    completedAt: "",
  },
  results: scenarios.map((scenario) => ({
    id: scenario.id,
    result: "not_run",
    evidence: "",
    notes: "",
    defectLink: null,
    retestResult: "not_required",
  })),
};
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(form, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Generated ${scenarios.length}-scenario physical-device results form: ${output}`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}
function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
