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

if (process.argv.slice(2).some((arg) => ["--linked", "--db-url", "--project-ref"].includes(arg))) {
  fail("remote-targeting arguments are forbidden; this workflow is local-only.");
}

const configPath = path.join(root, "supabase", "config.toml");
if (!existsSync(configPath)) fail("supabase/config.toml is missing.");
const config = readFileSync(configPath, "utf8");
if (!config.includes('project_id = "daybreak-local"')) {
  fail("the Supabase config is not the expected disposable local project.");
}

const cli = run(npx, [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "--version"], {
  capture: true,
});
if (!cli.ok || cli.detail.trim() !== SUPABASE_VERSION) {
  fail(`Supabase CLI ${SUPABASE_VERSION} is unavailable. Check npm/network access.`);
}

const dockerServer = run(docker, ["version", "--format", "{{.Server.Version}}"], { capture: true });
if (!dockerServer.ok || !dockerServer.detail) {
  fail("Docker Engine is unavailable or stopped. Start Docker Desktop and retry.");
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
  fail(
    `duplicate migration versions must be reconciled before reset: ${duplicates
      .map(([version, files]) => `${version} (${files.join(", ")})`)
      .join("; ")}`
  );
}

if (process.argv.includes("--preflight-only")) {
  console.log(`Local database preflight passed with Supabase CLI ${SUPABASE_VERSION}.`);
  process.exit(0);
}

console.log("Starting disposable local Supabase services; all database commands force --local.");
const supabase = (...args) =>
  run(npx, [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, ...args]);
if (!supabase("start", "--workdir", root).ok) fail("local Supabase services could not start.");
if (!supabase("db", "reset", "--local", "--no-seed", "--workdir", root).ok) {
  fail("the disposable local database reset failed; no remote database was targeted.");
}
if (!supabase("test", "db", "--local", "--workdir", root).ok) {
  fail("local SQL/pgTAP tests failed; no remote database was targeted.");
}
console.log("Disposable local database reset and SQL tests passed.");
