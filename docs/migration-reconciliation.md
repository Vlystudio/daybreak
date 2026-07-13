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

Start from a clean checkout of the exact release commit. These commands only identify the project and read metadata:

```bash
export EXPECTED_PROJECT_REF=cybpuscssilbguypptxi
test "$(cat supabase/.temp/project-ref 2>/dev/null)" = "$EXPECTED_PROJECT_REF" || {
  echo "STOP: checkout is not linked to the expected project" >&2
  exit 1
}

npx --yes supabase@2.108.0 projects list --output json \
  | jq -e --arg ref "$EXPECTED_PROJECT_REF" '.[] | select(.id == $ref)' >/dev/null
npx --yes supabase@2.108.0 migration list --linked
```

If a database password is required, read it without echoing and export it only for this shell:

```bash
read -r -s -p "Production database password: " SUPABASE_DB_PASSWORD
echo
export SUPABASE_DB_PASSWORD
npx --yes supabase@2.108.0 migration list --linked
```

Capture the migration list in the approved evidence store. Record every remote/local row around versions `0020` through `0022`, including any name shown for `0021`.

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

| Remote history                                                                                                    | Remote objects                                                                   | Required disposition                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0021` clearly represents AI-cache body                                                                           | Both `input_hash` columns exist; subjective objects absent                       | Create a new, forward-only migration at the next unused version for the subjective body. Make it safely idempotent where PostgreSQL allows, validate on a clone, then stage. Do not rename the historical file.                        |
| `0021` clearly represents subjective body                                                                         | Subjective table/policies/index/trigger exist; either `input_hash` column absent | Create a new, forward-only migration for only the missing column(s), using `ADD COLUMN IF NOT EXISTS`. Validate on a clone, then stage.                                                                                                |
| `0021` exists but its name/body is ambiguous                                                                      | Both bodies fully exist                                                          | Do not add schema changes. Preserve the historical files and obtain DBA/Supabase support approval for a history-only reconciliation plan. Use `migration repair` only if that written plan names the exact version and desired status. |
| `0021` exists but its name/body is ambiguous                                                                      | One body partially or wholly absent                                              | Stop. Export the history row and schema, identify how production reached this state, and write a forward migration that creates only missing objects. Do not repair history until the forward state is proven.                         |
| No remote `0021` history                                                                                          | Neither body exists                                                              | Stop and investigate why later migrations are present without `0021`. Rehearse a complete forward application on a clone; do not apply both historical colliding files directly.                                                       |
| No remote `0021` history                                                                                          | One or both bodies exist                                                         | Stop. This is out-of-band schema drift. Preserve evidence and require an approved DBA/Supabase support plan.                                                                                                                           |
| Both logical bodies were applied manually but no reliable history row represents them                             | Both bodies exist                                                                | Treat as out-of-band drift, not as proof that a repair is safe. Stop and obtain an approved history reconciliation from the DBA/Supabase support.                                                                                      |
| A later object depends on either body                                                                             | Any                                                                              | Preserve the depended-on behavior. The proposed forward migration must be additive and replay through all later migrations on a clone; never remove or rewrite the depended-on object.                                                 |
| More than one remote `0021` row, checksum mismatch, unexpected object definitions, or nonstandard history columns | Any                                                                              | Stop. Do not guess, rename, or repair. Escalate with the read-only export and backup identifier.                                                                                                                                       |

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

The pgTAP suite currently depends on Basejump Supabase test-helper functions. Install and pin those helpers in the local test environment as documented in `supabase/tests/README.md`; a missing helper is also a blocker, not a test skip.

## 6. Staging and production gate

Only after clone and fresh-install proofs pass:

1. Have a second authorized reviewer approve the SQL and exact target project ref.
2. Apply through staging using the same mechanism planned for production.
3. Run migration-list, schema, RLS, application smoke, and deletion-isolation checks in staging.
4. Confirm the production backup is current and the rollback/forward-fix owner is present.
5. Apply only the reviewed forward migration. Never run `db reset` against a linked environment.
6. Re-run the read-only inspection and attach the output to release evidence.

Release stays blocked until every item is recorded. A passing web build or iOS archive does not override this database gate.
