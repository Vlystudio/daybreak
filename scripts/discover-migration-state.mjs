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

const allowed = new Set(["--read-only", "--static-check", "--expected-project-ref", "--evidence"]);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!allowed.has(arg)) fail(`unknown argument ${arg}.`);
  if (["--expected-project-ref", "--evidence"].includes(arg)) i += 1;
}

if (!args.includes("--read-only")) fail("explicit --read-only acknowledgement is required.");
const expectedRef = valueAfter("--expected-project-ref");
if (!expectedRef) fail("pass --expected-project-ref explicitly.");
if (expectedRef !== PRODUCTION_PROJECT_REF) {
  fail(`expected project must be the repository-approved ref ${PRODUCTION_PROJECT_REF}.`);
}

const linkedRefPath = path.join(root, "supabase", ".temp", "project-ref");
if (!existsSync(linkedRefPath))
  fail("supabase/.temp/project-ref is missing; project identity is ambiguous.");
const linkedRef = readFileSync(linkedRefPath, "utf8").trim();
if (linkedRef !== expectedRef) {
  fail(`linked project does not match the explicit expected project (${linkedRef || "empty"}).`);
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
const duplicateFiles = ["0021_ai_cache.sql", "0021_subjective_checkins.sql"];
const hashes = duplicateFiles.map((file) => {
  const contents = readFileSync(path.join(migrationsDir, file));
  return { file, sha256: createHash("sha256").update(contents).digest("hex").toUpperCase() };
});

const laterDependencies = [];
for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))) {
  const version = Number(file.split("_")[0]);
  if (!Number.isFinite(version) || version <= 21) continue;
  const contents = readFileSync(path.join(migrationsDir, file), "utf8");
  const matches = [...contents.matchAll(/subjective_checkins|input_hash/gi)].map((match) =>
    match[0].toLowerCase()
  );
  if (matches.length) laterDependencies.push({ file, terms: [...new Set(matches)] });
}

console.log(`Read-only discovery static check passed for ${expectedRef}.`);
for (const hash of hashes) console.log(`${hash.sha256}  ${hash.file}`);
console.log(
  laterDependencies.length
    ? `Later migration references: ${laterDependencies.map((item) => item.file).join(", ")}`
    : "Later migration references: none found by static scan."
);

if (args.includes("--static-check")) process.exit(0);

const evidencePath = valueAfter("--evidence");
if (!evidencePath || !path.isAbsolute(evidencePath)) {
  fail("live discovery requires an absolute --evidence path outside the repository.");
}
const relativeEvidence = path.relative(root, evidencePath);
if (!relativeEvidence.startsWith("..") && !path.isAbsolute(relativeEvidence)) {
  fail("evidence must be written outside the repository to prevent accidental commits.");
}

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) fail("SUPABASE_DB_PASSWORD is not present in the approved operator environment.");

const npxCommand = process.platform === "win32" ? process.execPath : "npx";
const npxPrefix =
  process.platform === "win32"
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
    : [];

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    input: options.input,
    env: options.env ?? process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.error || result.status !== 0) {
    fail(
      `${options.label ?? command} failed without writing evidence. ${result.error?.message ?? output}`
    );
  }
  return output;
}

function redact(text) {
  return text
    .split(password)
    .join("[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]");
}

try {
  const cliVersion = run(
    npxCommand,
    [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "--version"],
    { label: "pinned Supabase CLI check" }
  );
  if (!cliVersion.split(/\r?\n/).includes(SUPABASE_VERSION)) {
    fail(`Supabase CLI ${SUPABASE_VERSION} was not selected.`);
  }

  const migrationList = run(
    npxCommand,
    [...npxPrefix, "--yes", `supabase@${SUPABASE_VERSION}`, "migration", "list", "--linked"],
    { label: "read-only linked migration list" }
  );

  const connection =
    `host=db.${expectedRef}.supabase.co port=5432 dbname=postgres ` +
    `user=postgres.${expectedRef} sslmode=require`;
  const sqlOutput = run(
    "psql",
    [connection, "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    {
      label: "read-only production SQL inspection",
      env: { ...process.env, PGPASSWORD: password },
    }
  );

  const generatedAt = new Date().toISOString();
  const evidence = [
    "# Redacted migration discovery evidence",
    "",
    `- Generated: \`${generatedAt}\``,
    `- Expected and linked project ref: \`${expectedRef}\``,
    `- Supabase CLI: \`${SUPABASE_VERSION}\``,
    "- Mode: server-enforced read-only transaction",
    "- Production writes performed: no",
    "",
    "## Local duplicate migration hashes",
    "",
    "```text",
    ...hashes.map((item) => `${item.sha256}  ${item.file}`),
    "```",
    "",
    "## Later local migration dependency scan",
    "",
    "```json",
    JSON.stringify(laterDependencies, null, 2),
    "```",
    "",
    "## Linked migration list",
    "",
    "```text",
    redact(migrationList),
    "```",
    "",
    "## Read-only SQL inspection",
    "",
    "```text",
    redact(sqlOutput),
    "```",
    "",
  ].join("\n");

  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, evidence, { encoding: "utf8", flag: "wx" });
  console.log(`Redacted evidence written outside the repository: ${evidencePath}`);
} finally {
  delete process.env.SUPABASE_DB_PASSWORD;
}
