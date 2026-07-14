import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SUPABASE_VERSION = "2.108.0";
const root = process.cwd();
// Node cannot spawn .cmd shims with shell:false on Windows (EINVAL). Invoke
// npm's JS entrypoint with the current Node binary so arguments remain an array
// and never pass through a command shell.
const npx = process.platform === "win32" ? process.execPath : "npx";
const npxPrefix =
  process.platform === "win32"
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
    : [];
const docker = process.platform === "win32" ? "docker.exe" : "docker";

function fail(message) {
  console.error(`Database test preflight failed: ${message}`);
  process.exit(1);
}

function failAll(blockers) {
  console.error("Database test preflight blocked:");
  for (const blocker of blockers) console.error(`- ${blocker}`);
  console.error("No Supabase remote command was run and no remote state was modified.");
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.error) return { ok: false, detail: result.error.message };
  return {
    ok: result.status === 0,
    detail: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

const suppliedArgs = process.argv.slice(2);
const allowedArgs = new Set(["--preflight-only"]);
const unknownArgs = suppliedArgs.filter((arg) => !allowedArgs.has(arg));
if (unknownArgs.length > 0) {
  fail(
    `only --preflight-only is accepted; remote targets and arbitrary arguments are forbidden (${unknownArgs.join(
      ", "
    )}).`
  );
}

const configPath = path.join(root, "supabase", "config.toml");
if (!existsSync(configPath)) fail("supabase/config.toml is missing.");
const config = readFileSync(configPath, "utf8");
if (!config.includes('project_id = "daybreak-local"')) {
  fail("the Supabase config is not the expected disposable local project.");
}
if (config.includes("cybpuscssilbguypptxi")) {
  fail("the production project reference must never appear in the disposable local config.");
}

const blockers = [];

const cli = run(npx, [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "--version"], {
  capture: true,
});
if (!cli.ok || !cli.detail.split(/\r?\n/).includes(SUPABASE_VERSION)) {
  blockers.push(`Supabase CLI ${SUPABASE_VERSION} is unavailable. Check npm/network/cache access.`);
}

const migrationsDir = path.join(root, "supabase", "migrations");
const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
const versions = new Map();
for (const file of migrations) {
  const version = file.split("_")[0];
  const matches = versions.get(version) ?? [];
  matches.push(file);
  versions.set(version, matches);
}
const duplicates = [...versions.entries()].filter(([, files]) => files.length > 1);
if (duplicates.length > 0) {
  blockers.push(
    `duplicate migration versions must be reconciled before reset: ${duplicates
      .map(([version, files]) => `${version} (${files.join(", ")})`)
      .join("; ")}. Follow docs/migration-reconciliation.md; do not rename or bypass them.`
  );
}

const dockerClient = run(docker, ["--version"], { capture: true });
if (!dockerClient.ok) {
  blockers.push("Docker CLI is unavailable. Install Docker Desktop and retry.");
} else {
  const dockerServer = run(docker, ["version", "--format", "{{.Server.Version}}"], {
    capture: true,
  });
  if (!dockerServer.ok || !dockerServer.detail) {
    blockers.push("Docker Engine is stopped or unreachable. Start Docker Desktop and retry.");
  }
}

if (blockers.length > 0) failAll(blockers);

if (process.argv.includes("--preflight-only")) {
  console.log(`Local database preflight passed with Supabase CLI ${SUPABASE_VERSION}.`);
  process.exit(0);
}

const supabase = (...args) =>
  run(npx, [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, ...args]);
const wasRunning = run(
  npx,
  [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "status", "--workdir", root],
  { capture: true }
).ok;
const startedHere = !wasRunning;
let runBlocker = null;

console.log("Starting disposable local Supabase services; every database command forces --local.");
try {
  if (!supabase("start", "--workdir", root).ok) {
    runBlocker = "local Supabase services could not start.";
  } else if (!supabase("db", "reset", "--local", "--no-seed", "--workdir", root).ok) {
    runBlocker = "the disposable local database reset failed; no remote database was targeted.";
  } else if (!supabase("test", "db", "--local", "--workdir", root).ok) {
    runBlocker = "local SQL/pgTAP tests failed; no remote database was targeted.";
  } else {
    console.log("Disposable local database reset and SQL tests passed.");
  }
} finally {
  if (startedHere) {
    console.log("Stopping the disposable local Supabase services started by this command.");
    supabase("stop", "--no-backup", "--workdir", root);
  }
}
if (runBlocker) fail(runBlocker);
