import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SUPABASE_VERSION = "2.108.0";
const PRODUCTION_PROJECT_REF = "cybpuscssilbguypptxi";
const root = process.cwd();
const sqlPath = path.join(root, "scripts", "sql", "migration-discovery-read-only.sql");
const args = process.argv.slice(2);

function fail(message) {
  console.error(`Migration discovery stopped: ${message}`);
  process.exit(1);
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) return null;
  return args[index + 1];
}

const valueFlags = new Set(["--expected-project-ref", "--evidence", "--snapshot"]);
const allowed = new Set(["--read-only", "--static-check", ...valueFlags]);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!allowed.has(arg)) fail(`unknown argument ${arg}.`);
  if (valueFlags.has(arg)) {
    if (!args[i + 1] || args[i + 1].startsWith("--")) fail(`${arg} requires a value.`);
    i += 1;
  }
}

if (!args.includes("--read-only")) fail("explicit --read-only acknowledgement is required.");
const expectedRef = valueAfter("--expected-project-ref");
if (!expectedRef) fail("pass --expected-project-ref explicitly.");
if (expectedRef !== PRODUCTION_PROJECT_REF) {
  fail(`expected project must be the repository-approved ref ${PRODUCTION_PROJECT_REF}.`);
}

if (!existsSync(sqlPath)) fail("read-only discovery SQL is missing.");
const sql = readFileSync(sqlPath, "utf8");
const sqlWithoutComments = sql.replace(/^\s*--.*$/gm, "");
if (!/\bBEGIN\s+READ\s+ONLY\b/i.test(sqlWithoutComments)) {
  fail("SQL does not begin an enforced read-only transaction.");
}
if (!/\bCOMMIT\b/i.test(sqlWithoutComments)) fail("SQL transaction has no COMMIT.");
const forbidden = sqlWithoutComments.match(
  /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY)\b/i
);
if (forbidden) fail(`SQL contains forbidden statement keyword ${forbidden[1].toUpperCase()}.`);

const migrationsDir = path.join(root, "supabase", "migrations");
const legacyMigrationsDir = path.join(root, "supabase", "legacy-migrations");
const hash = (contents) => createHash("sha256").update(contents).digest("hex").toUpperCase();
const activeMigrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((file) => ({
    version: file.slice(0, 4),
    file,
    sha256: hash(readFileSync(path.join(migrationsDir, file))),
  }));
const legacyMigrations = ["0021_ai_cache.sql", "0021_subjective_checkins.sql"].map((file) => ({
  file,
  sha256: hash(readFileSync(path.join(legacyMigrationsDir, file))),
}));
const laterDependencies = activeMigrations
  .filter(({ version }) => Number(version) > 21)
  .map(({ file }) => {
    const contents = readFileSync(path.join(migrationsDir, file), "utf8");
    const terms = [...contents.matchAll(/subjective_checkins|input_hash/gi)].map((match) =>
      match[0].toLowerCase()
    );
    return { file, terms: [...new Set(terms)] };
  })
  .filter(({ terms }) => terms.length > 0);

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function sanitizeSnapshot(raw) {
  if (!raw || raw.schemaVersion !== 1 || raw.transactionReadOnly !== true) {
    fail("snapshot is not schemaVersion 1 read-only discovery output.");
  }
  const subjective = raw.legacy0021Effects?.subjectiveCheckins ?? {};
  const sanitizeNamed = (items, extra = {}) =>
    Array.isArray(items)
      ? items.map((item) => ({
          name: typeof item?.name === "string" ? item.name : null,
          ...Object.fromEntries(
            Object.keys(extra).map((key) => [
              key,
              typeof item?.[key] === extra[key] ? item[key] : null,
            ])
          ),
        }))
      : [];
  return {
    schemaVersion: 1,
    transactionReadOnly: true,
    migrationHistory: Array.isArray(raw.migrationHistory)
      ? raw.migrationHistory.map((row) => ({
          version: typeof row?.version === "string" ? row.version : null,
          name: typeof row?.name === "string" ? row.name : null,
          checksum: typeof row?.checksum === "string" ? row.checksum : null,
        }))
      : [],
    legacy0021Effects: {
      dailySummariesInputHash: raw.legacy0021Effects?.dailySummariesInputHash === true,
      fitnessPlansInputHash: raw.legacy0021Effects?.fitnessPlansInputHash === true,
      subjectiveCheckins: {
        exists: subjective.exists === true,
        rls: subjective.rls === true,
        forceRls: subjective.forceRls === true,
        columns: Array.isArray(subjective.columns)
          ? subjective.columns.map((column) => ({
              name: typeof column?.name === "string" ? column.name : null,
              type: typeof column?.type === "string" ? column.type : null,
              nullable: typeof column?.nullable === "string" ? column.nullable : null,
            }))
          : [],
        constraints: sanitizeNamed(subjective.constraints, {
          type: "string",
          definition: "string",
        }),
        policies: Array.isArray(subjective.policies)
          ? subjective.policies.map((policy) => ({
              name: typeof policy?.name === "string" ? policy.name : null,
              permissive: typeof policy?.permissive === "string" ? policy.permissive : null,
              roles: stringList(policy?.roles),
              command: typeof policy?.command === "string" ? policy.command : null,
            }))
          : [],
        indexes: sanitizeNamed(subjective.indexes, { definition: "string" }),
        triggers: sanitizeNamed(subjective.triggers, { definition: "string" }),
      },
    },
    dependencies: {
      views: Array.isArray(raw.dependencies?.views)
        ? raw.dependencies.views.map((view) => ({
            schema: typeof view?.schema === "string" ? view.schema : null,
            name: typeof view?.name === "string" ? view.name : null,
          }))
        : [],
      triggers: Array.isArray(raw.dependencies?.triggers)
        ? raw.dependencies.triggers.map((trigger) => ({
            schema: typeof trigger?.schema === "string" ? trigger.schema : null,
            table: typeof trigger?.table === "string" ? trigger.table : null,
            name: typeof trigger?.name === "string" ? trigger.name : null,
          }))
        : [],
    },
  };
}

function classify(observed) {
  const effects = observed.legacy0021Effects;
  const subjective = effects.subjectiveCheckins;
  const columns = new Set(subjective.columns.map(({ name }) => name));
  const policies = new Set(subjective.policies.map(({ name }) => name));
  const indexes = new Set(subjective.indexes.map(({ name }) => name));
  const triggers = new Set(subjective.triggers.map(({ name }) => name));
  const aiCacheComplete = effects.dailySummariesInputHash && effects.fitnessPlansInputHash;
  const subjectiveComplete =
    subjective.exists &&
    subjective.rls &&
    ["id", "user_id", "date", "mood", "energy", "note", "created_at", "updated_at"].every((name) =>
      columns.has(name)
    ) &&
    [
      "subjective_checkins: read own",
      "subjective_checkins: insert own",
      "subjective_checkins: update own",
    ].every((name) => policies.has(name)) &&
    indexes.has("subjective_checkins_user_date_idx") &&
    triggers.has("touch_subjective_checkins");
  const versions = new Set(observed.migrationHistory.map(({ version }) => version));
  const forwardApplied = versions.has("0048");
  const currentApplied = activeMigrations.every(({ version }) => versions.has(version));
  const anyEffect =
    effects.dailySummariesInputHash || effects.fitnessPlansInputHash || subjective.exists;
  const partialState =
    effects.dailySummariesInputHash !== effects.fitnessPlansInputHash ||
    (subjective.exists && !subjectiveComplete) ||
    (forwardApplied && (!aiCacheComplete || !subjectiveComplete));
  let state = "legacy_0021_effects_absent";
  if (partialState) state = "partial_or_inconsistent_state";
  else if (forwardApplied && aiCacheComplete && subjectiveComplete) state = "forward_reconciled";
  else if (aiCacheComplete && subjectiveComplete) state = "both_legacy_bodies_or_canonical_0021";
  else if (aiCacheComplete) state = "legacy_ai_cache_body_only";
  else if (subjectiveComplete) state = "legacy_subjective_checkins_body_only";
  else if (anyEffect) state = "unclassified_effects";
  return {
    state,
    aiCacheComplete,
    subjectiveCheckinsComplete: subjectiveComplete,
    forwardReconciliationApplied: forwardApplied,
    repositoryHeadApplied: currentApplied,
    partialState,
    reconciliationNeeded: !forwardApplied || !aiCacheComplete || !subjectiveComplete,
    safeNextStep:
      partialState || (forwardApplied && (!aiCacheComplete || !subjectiveComplete))
        ? "STOP: investigate the partial schema before any migration execution"
        : !forwardApplied
          ? "prepare a reviewed backup-backed forward migration plan; do not repair history"
          : !currentApplied
            ? "review the remaining forward-only migration plan against a current backup"
            : "no repository migration action indicated by this snapshot",
  };
}

function evidenceFor(observed, source) {
  const checksums = observed.migrationHistory.filter(({ checksum }) => checksum);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "server-enforced read-only discovery",
    source,
    productionWritesPerformed: false,
    target: { projectRefSha256: hash(expectedRef).slice(0, 16) },
    repositoryExpectations: {
      supabaseCli: SUPABASE_VERSION,
      activeMigrations,
      historicalDuplicate0021: legacyMigrations,
      laterDependencies,
    },
    observed,
    checksumComparison: {
      observedChecksumsAvailable: checksums.length > 0,
      note:
        checksums.length > 0
          ? "Observed checksums are retained for operator comparison."
          : "The production migration ledger does not expose checksums; schema effects are used for duplicate-0021 classification.",
    },
    classification: classify(observed),
    sanitization: {
      connectionStringStored: false,
      credentialStored: false,
      hostnameStored: false,
      userDataQueried: false,
    },
  };
}

function writeEvidence(evidencePath, evidence) {
  const resolved = path.resolve(root, evidencePath);
  const allowedRoot = path.resolve(root, "build", "release-evidence");
  const canonicalEvidence = path.resolve(
    root,
    "docs",
    "launch-readiness",
    "evidence",
    "database",
    "production-migration-discovery.json"
  );
  if (resolved !== canonicalEvidence && !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    fail(
      "evidence must be under build/release-evidence or at the canonical reviewed docs evidence path."
    );
  }
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`Sanitized structured evidence written: ${path.relative(root, resolved)}`);
}

console.log(
  `Read-only discovery static check passed (${activeMigrations.length} active migrations; ${legacyMigrations.length} historical 0021 fingerprints).`
);
if (args.includes("--static-check")) process.exit(0);

const evidencePath =
  valueAfter("--evidence") ??
  path.join("build", "release-evidence", "production-migration-discovery.sanitized.json");
const snapshotPath = valueAfter("--snapshot");
if (snapshotPath) {
  if (!existsSync(snapshotPath)) fail(`snapshot does not exist: ${snapshotPath}.`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(snapshotPath, "utf8"));
  } catch {
    fail("snapshot is not valid JSON.");
  }
  const observed = sanitizeSnapshot(parsed.observed ?? parsed);
  writeEvidence(evidencePath, evidenceFor(observed, "operator-supplied sanitized snapshot"));
  process.exit(0);
}

const linkedRefPath = path.join(root, "supabase", ".temp", "project-ref");
if (!existsSync(linkedRefPath))
  fail("supabase/.temp/project-ref is missing; project identity is ambiguous.");
if (readFileSync(linkedRefPath, "utf8").trim() !== expectedRef) {
  fail("linked project does not match the explicit repository-approved production project.");
}
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) fail("SUPABASE_DB_PASSWORD is unavailable in the approved operator environment.");

const connection =
  `host=db.${expectedRef}.supabase.co port=5432 dbname=postgres ` +
  `user=postgres.${expectedRef} sslmode=require`;
try {
  const result = spawnSync(
    "psql",
    [connection, "-X", "--no-psqlrc", "-Atq", "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: { ...process.env, PGPASSWORD: password },
    }
  );
  if (result.error || result.status !== 0) {
    fail(
      `read-only inspection failed without evidence (${result.error?.message ?? "psql error"}).`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    fail("read-only inspection returned an unexpected non-JSON result; no evidence was written.");
  }
  writeEvidence(
    evidencePath,
    evidenceFor(sanitizeSnapshot(parsed), "authorized live read-only query")
  );
} finally {
  delete process.env.SUPABASE_DB_PASSWORD;
}
