# Portable database runtime verification

Daybreak database verification supports the disposable local Supabase stack and
an explicitly authorized, disposable remote Supabase test project. Production
is denied under every configuration.

## Local mode

Local mode preserves the established behavior and requires Docker:

```bash
npm run test:db:preflight
npm run test:db:local
```

Every Supabase command forces `--local`. Checked-in `supabase/.temp` link state
is forbidden and ignored because it can silently retain an unrelated remote
project identity.

## Create the isolated remote project

1. Create a dedicated Supabase project containing no users, application data,
   or production backups. Never clone production data into it.
2. Give it a non-production Auth site origin. Do not use
   `https://daybreak-one.vercel.app`.
3. Confirm the database is named `postgres`. Use a temporary project database
   password where operationally possible and rotate it after the run.
4. In the test project's SQL editor, install the database-level marker below.
   Replace all angle-bracket values and set a near-term expiry. The marker is a
   database setting, so it survives Supabase's remote user-schema reset. The
   runner reads it directly from `pg_db_role_setting`; a session variable cannot
   spoof it.

```sql
alter database postgres set daybreak.isolated_test_environment =
  '{
    "schemaVersion": 1,
    "environment": "isolated-remote-test",
    "projectRef": "<isolated-test-project-ref>",
    "applicationOrigin": "https://<non-production-origin>",
    "production": false,
    "productionDataPresent": false,
    "destructiveTestingAllowed": true,
    "approvedRoles": ["postgres"],
    "allowedDatabases": ["postgres"],
    "expectedInitialAuthUserCount": 0,
    "expiresAt": "<future-ISO-8601-timestamp>"
  }';
```

Do not set `daybreak.production_environment` on the test project. If that
database-level setting exists at all, the runner stops.

## Secure environment

Set credentials only in the current process environment or a protected CI
secret store. Do not put them in `.env` files, shell scripts, command arguments,
workflow variables, or evidence.

| Variable                                  | Purpose                                                                                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DAYBREAK_DB_TEST_MODE=isolated-remote`   | Mandatory explicit remote selection.                                                                                                                                                                                                     |
| `DAYBREAK_DB_TEST_PROJECT_REF`            | Expected isolated project ref.                                                                                                                                                                                                           |
| `DAYBREAK_DB_TEST_ALLOWED_PROJECT_REFS`   | Comma-separated operator allowlist; must contain the expected ref.                                                                                                                                                                       |
| `DAYBREAK_DB_TEST_ALLOWED_DATABASES`      | Database allowlist, normally `postgres`.                                                                                                                                                                                                 |
| `DAYBREAK_DB_TEST_EXPECTED_ROLE`          | Approved database role, normally `postgres` for Supabase reset.                                                                                                                                                                          |
| `DAYBREAK_DB_TEST_APPLICATION_ORIGIN`     | Exact non-production origin also recorded in the marker.                                                                                                                                                                                 |
| `DAYBREAK_DB_TEST_PRODUCTION_PROJECT_REF` | Optional additional production ref to deny; the known production ref is always denied.                                                                                                                                                   |
| `DAYBREAK_DB_TEST_DESTRUCTIVE_ACK`        | Exact acknowledgement shown below.                                                                                                                                                                                                       |
| `DAYBREAK_DB_TEST_CREDENTIAL_APPROVAL`    | Exact credential approval shown below.                                                                                                                                                                                                   |
| `SUPABASE_ACCESS_TOKEN`                   | Protected Supabase CLI token used to link the temporary workdir and read the project's Auth configuration. A fine-grained token needs project/database link access plus `auth_config_read`; a PAT has the operator's account privileges. |
| `SUPABASE_DB_PASSWORD`                    | Protected isolated-project database password.                                                                                                                                                                                            |

The exact acknowledgements are:

```text
I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_DISPOSABLE_TEST_DATABASE
I_APPROVE_THIS_CREDENTIAL_FOR_ISOLATED_DESTRUCTIVE_DATABASE_TESTS
```

Run the read-only identity/safety preflight first, then the complete suite:

```bash
npm run test:db:preflight:remote
npm run test:db:remote
```

Preflight creates only a temporary local link and reads database identity/state;
it performs no remote reset, fixture cleanup, migration, or extension install.
The full run installs pgTAP if needed, resets user-created entities, replays all
migrations, executes the upgrade matrix, and runs all pgTAP suites twice.

The runner never uses the repository's normal linked project. It copies
`supabase/` without `.temp` to an OS temporary directory, links that copy to the
expected ref, compares the actual managed Auth `site_url` with the marker and
approved non-production origin, validates the credential-free pooler identity,
and withholds the database password from the link command so it cannot enter
native link credential storage. The password is supplied only to the subsequent
destructive CLI commands and in-memory PostgreSQL client configuration. Generic
PostgreSQL connection environment variables are removed from every child
process so they cannot redirect the guarded linked target.

## Partial-failure recovery

On rerun, the guard permits only the exact UUID/email and Storage metadata
fixtures declared in repository test code. After revalidating every safeguard,
it deletes only those recognized fixtures before the next reset. Any other Auth
user, Storage bucket, Storage object, expired/mismatched marker, production
marker, role mismatch, or identity ambiguity is a hard stop requiring operator
inspection. Do not broaden the fixture allowlist to clear an unexplained state.

## Runtime dependency map

| Verification area                                                                                                                                                                              | Required surface                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordered fresh migrations, duplicate-`0021` matrix, representative upgrades, catalog checks, triggers, RPCs, RLS, eligibility, legal gating, consent, retention, and deletion-state transitions | PostgreSQL plus the repository migrations and synthetic fixtures.                                                                                                                                           |
| Auth signup trigger and cascade behavior                                                                                                                                                       | Supabase-managed `auth` schema, `auth.uid()`, and `anon`/`authenticated`/`service_role` database roles. These checks do not use the GoTrue HTTP API or service-role API key.                                |
| Storage bucket migration, metadata preservation, and SQL authorization                                                                                                                         | Supabase-managed `storage.buckets` and `storage.objects`. The remote recovery path deletes only recognized synthetic metadata; it does not claim object-provider cleanup.                                   |
| UUID/cryptographic defaults                                                                                                                                                                    | Supabase-supported `pgcrypto`.                                                                                                                                                                              |
| SQL test assertions                                                                                                                                                                            | Supabase-supported `pgtap`, installed into `extensions` only after all remote safeguards pass.                                                                                                              |
| Local orchestration                                                                                                                                                                            | Supabase CLI local services and Docker. Only `local` mode needs them.                                                                                                                                       |
| Isolated-remote orchestration                                                                                                                                                                  | Supabase CLI link/reset/migration support, Management API Auth-config read access, and direct TLS PostgreSQL. It does not start local Supabase services or Docker.                                          |
| End-to-end Auth sessions, Storage object deletion, repeated worker retries/partial-failure recovery, and provider token invalidation                                                           | Staging application execution with dedicated test users and provider credentials; outside the database evidence claim. Repository unit tests cover worker orchestration but are not provider/runtime proof. |

## Protected GitHub execution

`.github/workflows/database-runtime.yml` is manual-only and uses the protected
GitHub Environment `isolated-database-tests`. Configure the non-secret identity
values as environment variables, credentials as environment secrets, and
require an environment reviewer. The workflow asks the operator to type both
exact acknowledgements for each run and uploads sanitized success evidence only
when the entire suite passes.

## Evidence interpretation

The schema-v3 evidence identifies the selected mode and a one-way project-ref
fingerprint. It never records hostnames, connection strings, tokens, passwords,
or raw project refs.

- PostgreSQL migration, trigger, RPC, RLS, and pgTAP results are verified.
- Supabase Auth database triggers/rows are verified; Auth HTTP/dashboard/session
  configuration is not.
- Supabase Storage metadata/policies are verified; object-service deletion is
  not.
- Application deletion retry/session behavior and provider revocation still
  require isolated staging plus dedicated provider credentials.
