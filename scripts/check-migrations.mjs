import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const activeDir = path.join(root, "supabase", "migrations");
const legacyDir = path.join(root, "supabase", "legacy-migrations");

function fail(message) {
  console.error(`Migration integrity failed: ${message}`);
  process.exit(1);
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

const active = readdirSync(activeDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
if (active.length === 0) fail("no active SQL migrations found.");

const versions = new Map();
for (const file of active) {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) fail(`active migration has an invalid deterministic name: ${file}.`);
  const version = match[1];
  const matches = versions.get(version) ?? [];
  matches.push(file);
  versions.set(version, matches);
}

const duplicates = [...versions.entries()].filter(([, files]) => files.length > 1);
if (duplicates.length > 0) {
  fail(
    `ambiguous active versions: ${duplicates
      .map(([version, files]) => `${version} (${files.join(", ")})`)
      .join("; ")}.`
  );
}

const numericVersions = [...versions.keys()].map(Number).sort((a, b) => a - b);
for (let expected = numericVersions[0]; expected <= numericVersions.at(-1); expected += 1) {
  if (!numericVersions.includes(expected)) {
    fail(`active sequence has a gap at ${String(expected).padStart(4, "0")}.`);
  }
}

const expectedLegacy = new Map([
  ["0021_ai_cache.sql", "035E2248D136837511175BC18421AABC1F5482DCEFE00ECE79EEC34F50F17312"],
  [
    "0021_subjective_checkins.sql",
    "81D5E33BFB16AC22C17E5129321CA020606F16B2570B18DF6105FD7CE3F447FB",
  ],
]);
for (const [file, expectedHash] of expectedLegacy) {
  const filePath = path.join(legacyDir, file);
  if (!existsSync(filePath)) fail(`historical migration archive is missing ${file}.`);
  const actual = sha256(filePath);
  if (actual !== expectedHash) fail(`historical migration ${file} changed (${actual}).`);
}

const canonicalPath = path.join(activeDir, "0021_reconciled_legacy_bodies.sql");
const forwardPath = path.join(activeDir, "0048_reconcile_0021.sql");
if (!existsSync(canonicalPath)) fail("canonical fresh-install 0021 is missing.");
if (!existsSync(forwardPath)) fail("forward-only 0021 reconciliation migration is missing.");

const canonical = readFileSync(canonicalPath, "utf8");
for (const marker of [
  "daily_summaries add column if not exists input_hash",
  "fitness_plans add column if not exists input_hash",
  "create table public.subjective_checkins",
  "enable row level security",
]) {
  if (!canonical.toLowerCase().includes(marker)) {
    fail(`canonical 0021 is missing required body marker: ${marker}.`);
  }
}

const forward = readFileSync(forwardPath, "utf8").toLowerCase();
for (const marker of [
  "create table if not exists public.subjective_checkins",
  "add column if not exists input_hash",
  "raise exception",
  "enable row level security",
  "create index if not exists subjective_checkins_user_date_idx",
]) {
  if (!forward.includes(marker)) {
    fail(`forward reconciliation is missing safety marker: ${marker}.`);
  }
}

console.log(
  `PASS — migration integrity verified: ${active.length} unique active versions ` +
    `${String(numericVersions[0]).padStart(4, "0")}–${String(numericVersions.at(-1)).padStart(4, "0")}; ` +
    "both historical 0021 checksums preserved; canonical and forward reconciliation present."
);
