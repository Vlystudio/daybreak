# Supabase migration reconciliation runbook

## Release status

Database migration history is a release blocker until an authorized operator completes this runbook against project `cybpuscssilbguypptxi` and records the result. The repository contains two different historical migrations with version `0021`:

- `0021_ai_cache.sql` adds nullable `input_hash` columns to `daily_summaries` and `fitness_plans`. Both statements use `IF NOT EXISTS`.
- `0021_subjective_checkins.sql` creates `subjective_checkins`, its index, RLS policies, and `updated_at` trigger. This file is not idempotent.

Do not rename either file, run `migration repair`, or push a migration to production merely to make the local and remote lists agree. First establish what SQL and what history actually exist remotely.

Local SHA-256 fingerprints as of this runbook:

```text
035E2248D136837511175BC18421AABC1F5482DCEFE00ECE79EEC34F50F17312  0021_ai_cache.sql
81D5E33BFB16AC22C17E5129321CA020606F16B2570B18DF6105FD7CE3F447FB  0021_subjective_checkins.sql
```

Later migration files do not directly reference either body. The application does use both `input_hash` columns and `subjective_checkins`, and the RLS test suite expects `subjective_checkins`.

## Preconditions and safety boundaries

Use a secure operator workstation with the pinned Supabase CLI, `psql`, `jq`, and access to the intended project. Confirm all of the following before connecting:

- You are authorized to inspect production metadata and row counts.
- A current, restorable backup exists and its restore procedure has been tested.
- `EXPECTED_PROJECT_REF` is exactly `cybpuscssilbguypptxi`.
- No command below contains a write operation while connected to production.
- The password is supplied interactively or by the secret manager. Never paste it into a command, shell history, document, or ticket.

Stop immediately if the linked ref is different, the project cannot be unambiguously identified, the backup is unavailable, remote history has unexpected duplicate rows, or observed objects contradict the matrix below.

## 1. Read-only remote discovery

Start from a clean checkout of the exact release commit. First validate the executable discovery tool without credentials or network access:

```bash
node scripts/discover-migration-state.mjs \
  --static-check \
  --read-only \
  --expected-project-ref cybpuscssilbguypptxi
```

The static check requires the explicit production ref, verifies it matches `supabase/.temp/project-ref`, fingerprints both duplicate files, scans later migrations, and rejects any DDL/DML keyword in `scripts/sql/migration-discovery-read-only.sql`.

After access and backup approval, run the live read-only discovery. The evidence path must be absolute and outside the repository; the tool refuses to overwrite a file:

```bash
export EXPECTED_PROJECT_REF=cybpuscssilbguypptxi
test "$(cat supabase/.temp/project-ref 2>/dev/null)" = "$EXPECTED_PROJECT_REF" || {
  echo "STOP: checkout is not linked to the expected project" >&2
  exit 1
}

read -r -s -p "Production database password: " SUPABASE_DB_PASSWORD
echo
export SUPABASE_DB_PASSWORD
trap 'unset SUPABASE_DB_PASSWORD' EXIT

node scripts/discover-migration-state.mjs \
  --read-only \
  --expected-project-ref "$EXPECTED_PROJECT_REF" \
  --evidence "/approved/evidence/daybreak-migration-discovery-$(date -u +%Y%m%dT%H%M%SZ).md"

unset SUPABASE_DB_PASSWORD
trap - EXIT
```

The tool pins Supabase CLI `2.108.0`, runs `migration list --linked`, invokes `psql` without embedding the password in arguments, enforces `BEGIN READ ONLY`, inspects the history and both logical bodies, checks database dependencies, redacts credential-shaped text, writes evidence outside Git, and removes the password from its own process environment. It performs no DDL or DML. Preserve the resulting file in the approved evidence store.

The manual SQL below is a reviewable fallback and mirrors the committed script. Prefer the executable tool so project/ref checks and redaction cannot be skipped.

Recompute the local fingerprints rather than trusting copied text:

```bash
sha256sum supabase/migrations/0021_ai_cache.sql \
  supabase/migrations/0021_subjective_checkins.sql
# PowerShell equivalent:
# Get-FileHash supabase/migrations/0021_ai_cache.sql,supabase/migrations/0021_subjective_checkins.sql -Algorithm SHA256
```

For a direct, read-only SQL inspection, use a transaction that the server enforces as read-only:

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "host=db.${EXPECTED_PROJECT_REF}.supabase.co port=5432 dbname=postgres user=postgres.${EXPECTED_PROJECT_REF} sslmode=require" \
  -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;

-- Discover the history table shape before assuming a name/checksum column.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

SELECT to_jsonb(m)
FROM supabase_migrations.schema_migrations AS m
WHERE to_jsonb(m)->>'version' IN ('0020', '0021', '0022')
ORDER BY to_jsonb(m)->>'version';

-- Object state for the two 0021 bodies.
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_schema, table_name, column_name) IN (
  ('public', 'daily_summaries', 'input_hash'),
  ('public', 'fitness_plans', 'input_hash')
)
ORDER BY table_name;

SELECT to_regclass('public.subjective_checkins') AS subjective_checkins;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'subjective_checkins';

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
ORDER BY policyname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
ORDER BY indexname;

SELECT tg.tgname, pg_get_triggerdef(tg.oid)
FROM pg_trigger AS tg
JOIN pg_class AS c ON c.oid = tg.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'subjective_checkins'
  AND NOT tg.tgisinternal;

COMMIT;
SQL
```

If policy permits aggregate production inspection, separately record only non-identifying counts and date bounds. Skip this query if even aggregate metadata is restricted:

```sql
BEGIN READ ONLY;
SELECT count(*) AS row_count, min(date) AS first_date, max(date) AS last_date
FROM public.subjective_checkins;
COMMIT;
```

## 2. Dependency inspection

Before designing a forward migration, inspect database dependencies rather than relying only on repository search:

```sql
BEGIN READ ONLY;
SELECT dependent_ns.nspname AS dependent_schema,
       dependent.relname AS dependent_object,
       dependent.relkind,
       pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) AS referenced_object
FROM pg_depend AS d
JOIN pg_class AS dependent ON dependent.oid = d.objid
JOIN pg_namespace AS dependent_ns ON dependent_ns.oid = dependent.relnamespace
WHERE pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid)
      ~ '(subjective_checkins|daily_summaries.input_hash|fitness_plans.input_hash)'
ORDER BY 1, 2;

SELECT schemaname, viewname, definition
FROM pg_views
WHERE definition ~* '(subjective_checkins|input_hash)';
COMMIT;
```

The corresponding repository check is:

```bash
rg -n "subjective_checkins|input_hash" src supabase --glob '!supabase/migrations/0021_*'
```

## 3. Decision matrix

| Scenario                                                                  | Evidence required                                                                                                                  | Stop? / clone                         | Likely reconciliation class                            | Forward-only migration                                                                                             | History repair                                                                                                           | Approval/checkpoint/tests                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| First `0021` (AI cache) recorded; subjective body absent                  | Exact history row/name/hash where available; both `input_hash` columns; absence of table/policies/index/trigger; dependency report | Stop production work; clone mandatory | Add missing logical body under a new unused version    | Likely appropriate, creating only missing subjective objects and preserving expected definitions                   | Not needed merely to add the missing body                                                                                | DBA + application owner; verified backup before clone; fresh reset, pgTAP/RLS, representative check-in CRUD, deletion verification  |
| Second `0021` (subjective) recorded; one/both `input_hash` columns absent | History evidence; complete subjective definitions; column inspection; dependency report                                            | Stop production work; clone mandatory | Add missing nullable columns                           | Likely appropriate using `ADD COLUMN IF NOT EXISTS` only for absent columns                                        | Not needed merely to add columns                                                                                         | DBA + application owner; backup; full replay, AI generation/cache behavior, SQL/RLS/deletion tests                                  |
| One `0021` recorded; both logical bodies fully exist                      | History row plus exact schema definitions and evidence of how the unrecorded body arrived                                          | Stop; clone mandatory                 | History/schema reconciliation with no behavior removal | Only if clone comparison finds a real missing/drifted object; otherwise no schema migration                        | May be considered only under a written DBA/Supabase-support plan after backup; never inferred from object presence alone | DBA and Supabase support or equivalent owner; restorable backup; clone migration-list parity, schema diff, full app tests           |
| Neither `0021` recorded; both logical bodies exist                        | Complete history export, DDL definitions, audit/change records if available, later versions                                        | Stop; clone mandatory                 | Out-of-band/manual schema drift                        | Not until origin is understood; any forward migration must be additive and describe existing state                 | Possible only with explicit support-approved history plan                                                                | DBA + security/production-change approver; backup before any history action; clone replay from production history and fresh install |
| Neither schema change exists                                              | History before/after `0021`, later versions, dependency scan                                                                       | Stop; clone mandatory                 | Missing migrations/incomplete history                  | A reviewed new forward migration may be appropriate only after proving later migrations replay without both bodies | Do not repair history first                                                                                              | DBA + application owner; backup; full zero-to-head reset, SQL/RLS, AI/check-in flows, deletion                                      |
| Partial `subjective_checkins` objects exist                               | Table columns/constraints, RLS flags, every policy/index/trigger definition, row-count approval if needed                          | Stop; clone mandatory                 | Partial manual application/schema drift                | May create only objectively missing objects; never drop unexpected objects to force a match                        | Not before schema provenance is established                                                                              | DBA + privacy/security reviewer; backup; data-preserving clone rehearsal, RLS negative tests, CRUD and deletion                     |
| Unexpected policies exist                                                 | Policy names, roles, commands, `qual`, `with_check`, grants, provenance                                                            | Stop; clone mandatory                 | Security-sensitive schema drift                        | Only an additive/security-reviewed change; removal or replacement requires separate explicit approval              | Not relevant until desired schema is approved                                                                            | DBA + security/privacy owner; backup; adversarial RLS tests for two users and service role                                          |
| Unexpected trigger exists                                                 | Trigger definition, function definition/owner/security mode, dependencies, provenance                                              | Stop; clone mandatory                 | Behavioral schema drift                                | Only after proving data and side effects; do not replace blindly                                                   | Not relevant until behavior is understood                                                                                | DBA + application/security owner; backup; replay, write-path, audit, performance, deletion tests                                    |
| Later database or repository migration depends on either body             | Dependency output and clean replay through every later migration                                                                   | Stop; clone mandatory                 | Preserve-dependent forward reconciliation              | Must be additive and maintain all depended-on objects/signatures                                                   | Only after schema is correct and written support plan exists                                                             | DBA + owners of dependent behavior; backup; zero-to-head and production-history replay, all SQL/RLS/application tests               |
| Production differs from every repository expectation                      | Full redacted discovery, schema-only dump, history export, provenance investigation                                                | Stop; clone mandatory                 | Unknown drift/incident investigation                   | Not selected until differences are classified                                                                      | Not selected                                                                                                             | DBA + security + production incident/change authority; verified backup/restore; bespoke clone plan and complete regression suite    |
| Migration history is incomplete/corrupt or contains multiple `0021` rows  | Raw read-only history rows/columns, Supabase support evidence, backup identifier                                                   | Stop; clone mandatory                 | History corruption reconciliation                      | No schema migration until history and schema are independently understood                                          | May be considered only by DBA/Supabase support with exact version/status instructions                                    | Highest production DB approval; tested restore point; clone history operations, schema diff, full reset and application tests       |
| Schema was manually modified                                              | Change/audit evidence, current DDL, history, affected data and dependencies                                                        | Stop; clone mandatory                 | Out-of-band drift                                      | Possibly, to codify the approved final state without destructive normalization                                     | Only if separately needed and support-approved                                                                           | DBA + original change owner + security where applicable; backup; clone replay and affected-feature/deletion tests                   |

Whichever route is selected, record the exact observed history, object definitions, backup identifier, proposed SQL, reviewer, clone results, and staging results in the release evidence.

## 4. Rehearse on an isolated production clone

Never experiment against the linked production project. Create a temporary Supabase project or restore the approved backup to isolated Postgres. Use a separate checkout so `.temp/project-ref` cannot be confused with production:

```bash
git worktree add ../daybreak-migration-rehearsal <release-commit>
cd ../daybreak-migration-rehearsal
npx --yes supabase@2.108.0 link --project-ref "$CLONE_PROJECT_REF"
test "$(cat supabase/.temp/project-ref)" = "$CLONE_PROJECT_REF"
```

Apply the proposed new forward migration to the clone with the normal reviewed deployment mechanism. Verify:

1. The first application succeeds.
2. All expected columns, table constraints, RLS policies, index, and trigger match the reviewed definitions.
3. Existing row counts and representative application reads/writes remain correct.
4. A second deployment reports nothing pending; never test idempotency by manually re-running a recorded migration.
5. The migration list is linear and contains one unique new version.

With separate authenticated shells linked to the clone and production, create schema-only dumps and compare them in the approved evidence workspace:

```bash
npx --yes supabase@2.108.0 db dump --linked --schema public --file clone-public.sql
# Run from the production-linked clean checkout only after re-confirming its ref:
npx --yes supabase@2.108.0 db dump --linked --schema public --file production-public.sql
git diff --no-index -- production-public.sql clone-public.sql
```

Review every difference. Only the approved reconciliation and known environment-generated metadata may differ; an unexplained difference is a stop condition. These dumps can contain schema comments or defaults that expose operational details, so store them securely and do not commit them.

Destroy the isolated worktree only after evidence is saved. Do not copy its `.temp` directory back to the release checkout.

## 5. Prove fresh-install behavior locally

The repository wrapper is deliberately local-only and pins Supabase CLI `2.108.0`:

```bash
npm run test:db:preflight
npm run test:db
```

`npm run test:db` checks Docker, rejects remote flags, rejects duplicate migration versions, starts local Supabase, runs `db reset --local --no-seed`, and runs `test db --local`. At present, preflight must fail on the duplicate `0021`; that failure is expected and remains a release blocker. After the approved forward reconciliation also resolves the repository's fresh-install ordering without rewriting applied history, both commands must pass from a clean checkout.

The pgTAP RLS suite is self-contained and creates synthetic users inside a rolled-back transaction; it requires no third-party test-helper extension or production credential.

## 6. Staging and production gate

Only after clone and fresh-install proofs pass:

1. Have a second authorized reviewer approve the SQL and exact target project ref.
2. Apply through staging using the same mechanism planned for production.
3. Run migration-list, schema, RLS, application smoke, and deletion-isolation checks in staging.
4. Confirm the production backup is current and the rollback/forward-fix owner is present.
5. Apply only the reviewed forward migration. Never run `db reset` against a linked environment.
6. Re-run the read-only inspection and attach the output to release evidence.

Release stays blocked until every item is recorded. A passing web build or iOS archive does not override this database gate.
