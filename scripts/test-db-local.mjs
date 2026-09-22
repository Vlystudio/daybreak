import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDatabaseTestOptions } from "./lib/db-test-safety.mjs";
import { RemoteDatabaseTestHarness, SUPABASE_VERSION } from "./lib/remote-db-test-harness.mjs";

const root = process.cwd();
const npx = process.platform === "win32" ? process.execPath : "npx";
const npxPrefix =
  process.platform === "win32"
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
    : [];
const docker = process.platform === "win32" ? "docker.exe" : "docker";

function fail(message) {
  console.error(`Database test failed: ${message}`);
  process.exit(1);
}

function failAll(blockers, mode) {
  console.error(`Database test preflight blocked in ${mode} mode:`);
  for (const blocker of blockers) console.error(`- ${blocker}`);
  if (mode === "local") {
    console.error("No Supabase remote command was run and no remote state was modified.");
  } else {
    console.error("No remote destructive command was run.");
  }
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    // Keep optional CLI telemetry delivery out of the database test result.
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  });
  if (result.error) return { ok: false, detail: result.error.message };
  return {
    ok: result.status === 0,
    detail: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

let options;
try {
  options = resolveDatabaseTestOptions(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
const { mode, preflightOnly } = options;

const configPath = path.join(root, "supabase", "config.toml");
if (!existsSync(configPath)) fail("supabase/config.toml is missing.");
const config = readFileSync(configPath, "utf8");
if (!config.includes('project_id = "daybreak-local"')) {
  fail("the checked-in Supabase config is not the expected disposable local project.");
}
if (config.includes("cybpuscssilbguypptxi")) {
  fail("the production project reference must never appear in supabase/config.toml.");
}

const blockers = [];
const integrity = run(process.execPath, [path.join(root, "scripts", "check-migrations.mjs")], {
  capture: true,
});
if (!integrity.ok) blockers.push(integrity.detail || "migration integrity checker failed.");

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

if (mode === "local") {
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
}
if (blockers.length > 0) failAll(blockers, mode);

const localSupabase = (...args) =>
  run(npx, [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, ...args]);

let harness = null;
let localStartedHere = false;
let runBlocker = null;
let databaseIdentity;

try {
  if (mode === "isolated-remote") {
    harness = new RemoteDatabaseTestHarness(root);
    await harness.initialize();
    databaseIdentity = harness.sanitizedIdentity();
  }

  if (preflightOnly) {
    if (mode === "local") {
      console.log(`Local database preflight passed with Supabase CLI ${SUPABASE_VERSION}.`);
    } else {
      console.log(
        `Isolated-remote database preflight passed for project fingerprint ${databaseIdentity.projectRefFingerprint}.`
      );
    }
    process.exitCode = 0;
  } else if (mode === "local") {
    const wasRunning = run(
      npx,
      [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "status", "--workdir", root],
      { capture: true }
    ).ok;
    localStartedHere = !wasRunning;
    databaseIdentity = {
      kind: "disposable local Supabase",
      projectRefFingerprint: null,
      databaseName: "postgres",
      applicationOrigin: "local",
      credentialSource: "local Supabase defaults",
    };
    console.log(
      "Starting disposable local Supabase services; every database command forces --local."
    );
    const localSteps = [
      {
        execute: () => localSupabase("start", "--workdir", root).ok,
        blocker: "local Supabase services could not start.",
      },
      {
        execute: () => localSupabase("db", "reset", "--local", "--no-seed", "--workdir", root).ok,
        blocker: "the first disposable local database reset failed.",
      },
      {
        execute: () =>
          run(process.execPath, [
            path.join(root, "scripts", "test-db-upgrades.mjs"),
            "--mode",
            "local",
          ]).ok,
        blocker: "the duplicate-0021 or representative local upgrade matrix failed.",
      },
      {
        execute: () => localSupabase("test", "db", "--local", "--workdir", root).ok,
        blocker: "local SQL/pgTAP tests failed after the first reset.",
      },
      {
        execute: () => localSupabase("db", "reset", "--local", "--no-seed", "--workdir", root).ok,
        blocker: "the repeated disposable local database reset failed.",
      },
      {
        execute: () => localSupabase("test", "db", "--local", "--workdir", root).ok,
        blocker: "local SQL/pgTAP tests failed after the repeated reset.",
      },
    ];
    for (const step of localSteps) {
      if (!step.execute()) {
        runBlocker = step.blocker;
        break;
      }
    }
    if (!runBlocker) {
      console.log("Two disposable local database resets and both SQL test passes succeeded.");
    }
  } else {
    console.log("Running against the explicitly authorized isolated Supabase test project.");
    await harness.reset();
    await harness.disconnect();
    const upgrades = run(process.execPath, [
      path.join(root, "scripts", "test-db-upgrades.mjs"),
      "--mode",
      "isolated-remote",
    ]);
    if (!upgrades.ok) {
      runBlocker = "the duplicate-0021 or representative isolated-remote upgrade matrix failed.";
    } else {
      await harness.reconnect();
      await harness.runPgTap();
      await harness.reset();
      await harness.runPgTap();
      console.log(
        "Two isolated-remote database initializations and both SQL test passes succeeded."
      );
    }
  }
} catch (error) {
  runBlocker = harness ? harness.diagnostic(error.message) : error.message;
} finally {
  if (localStartedHere) {
    console.log("Stopping the disposable local Supabase services started by this command.");
    localSupabase("stop", "--no-backup", "--workdir", root);
  }
  if (harness) await harness.close();
}

if (preflightOnly) {
  if (runBlocker) failAll([runBlocker], mode);
  process.exit(0);
}
if (runBlocker) fail(runBlocker);

const upgradeResultPath = path.join(
  root,
  "build",
  "release-evidence",
  "database-upgrade-matrix.json"
);
if (!existsSync(upgradeResultPath)) {
  fail("the successful upgrade matrix did not produce its intermediate result");
}
const upgradeResult = JSON.parse(readFileSync(upgradeResultPath, "utf8"));
if (
  upgradeResult.mode !== mode ||
  !Array.isArray(upgradeResult.results) ||
  upgradeResult.results.some((result) => result.status !== "pass")
) {
  fail("the upgrade matrix intermediate result is incomplete or belongs to another mode");
}

const commitResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
  shell: false,
});
const canonicalEvidence = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  commit: commitResult.status === 0 ? commitResult.stdout.trim() : null,
  mode,
  databaseIdentity,
  supabaseCli: SUPABASE_VERSION,
  status: "pass",
  freshInitialization: { status: "pass", resets: 2 },
  duplicate0021AndRepresentativeUpgrades: {
    status: "pass",
    results: upgradeResult.results,
    historicalHashes: upgradeResult.historicalHashes,
  },
  pgTapAndRuntimeSecurity: {
    status: "pass",
    executions: 2,
    suites: [
      "RLS and cross-user isolation",
      "adult eligibility and existing-user legal gating",
      "AI consent, permit replay, and health authorization",
      "privacy rights and retention",
      "account deletion database behavior",
      "runtime trigger, RPC, Storage metadata, and privilege surface",
    ],
  },
  verificationBoundaries: {
    postgresql: "pass - migrations, fixtures, pgTAP, RLS, triggers, and RPCs",
    supabaseAuth:
      "pass for auth-schema triggers and synthetic Auth rows; Auth HTTP/provider configuration not exercised",
    supabaseStorage:
      "pass for storage metadata, bucket migration, and SQL authorization; Storage HTTP/object-provider cleanup not exercised",
    stagingApplication:
      "not exercised - end-to-end deletion retries, session rejection, and application orchestration require isolated staging execution",
    externalProviders:
      "not exercised - OAuth/provider invalidation requires dedicated non-production credentials",
  },
  productionAccessed: false,
  sensitiveData: false,
};
const canonicalEvidencePath = path.join(
  root,
  "docs",
  "launch-readiness",
  "evidence",
  "database",
  "fresh-and-upgrade-test.json"
);
mkdirSync(path.dirname(canonicalEvidencePath), { recursive: true });
writeFileSync(canonicalEvidencePath, `${JSON.stringify(canonicalEvidence, null, 2)}\n`, "utf8");
console.log(
  `Complete ${mode} database runtime evidence written to ${path.relative(root, canonicalEvidencePath)}.`
);
