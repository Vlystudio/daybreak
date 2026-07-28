# Database tests and upgrade matrix

The pgTAP suite verifies ownership isolation, restricted-account enforcement,
service-only RPC grants, storage write isolation, deletion durability, privacy
rights, AI consent permits, and retention. It is self-contained: fixtures are
created inside transactions and rolled back, so no third-party test-helper SQL
or production credential is required.

## Run

```bash
npm run test:db:preflight  # CLI, config, duplicate-version, and Docker checks
npm run test:db            # pinned CLI; local start/reset/test only
npm run test:db:upgrades   # matrix only; requires the disposable stack running
```

The wrapper:

- accepts only `--preflight-only` and rejects all remote/unknown arguments;
- pins Supabase CLI `2.108.0` through npm's cache rather than requiring a global install;
- requires `project_id = "daybreak-local"` and rejects the production ref in local config;
- verifies a unique, gap-free active migration sequence, the exact archived
  historical `0021` checksums, and both canonical/forward reconciliation files;
- reports Docker availability;
- runs six local-only legacy `0021` upgrade shapes plus representative
  pre-eligibility and pre-durable-deletion upgrades;
- forces two clean-head `db reset --local` and `test db --local` passes;
- stops and removes only the disposable local services it started; and
- never runs a linked reset or `db push`. The upgrade matrix uses
  `migration repair --local` only inside the disposable project to model
  historical production ledger shapes; it never accepts a project ref or
  database URL.

The two historical `0021` bodies are preserved byte-for-byte in
`supabase/legacy-migrations/`. Fresh installs use one canonical active `0021`,
and `0048_reconcile_0021.sql` converges already-deployed states without editing
remote history.

## Coverage

`rls_isolation_test.sql` creates two synthetic `auth.users`, seeds Alice's rows
as the database owner, switches to the local `authenticated` role with explicit
JWT claims, and verifies Bob sees zero while Alice sees exactly one row in:

- `health_metrics`
- `daily_summaries`
- `schedule_events`
- `subjective_checkins`

All fixtures roll back. Extend the suite whenever a new user-owned table or RLS
policy is added.

`runtime_security_surface_test.sql` additionally asserts every public table has
RLS, exercises cross-user SELECT/INSERT/UPDATE/DELETE behavior, rejects forged
provider health data, validates service-only function grants, checks that no
protected table is accidentally in the realtime publication, verifies the
server-owned avatar storage boundary, and proves each restricted eligibility
state loses protected access.

Successful upgrade execution writes a sanitized, commit-bound artifact to
`docs/launch-readiness/evidence/database/fresh-and-upgrade-test.json`. The file
is written only after every scenario passes.
