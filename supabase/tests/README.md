# Database tests (RLS isolation)

The pgTAP suite verifies that authenticated users cannot read another user's
health, briefing, schedule, or check-in rows. It is self-contained: fixtures are
created inside a transaction and rolled back, so no third-party test-helper SQL
or production credential is required.

## Run

```bash
npm run test:db:preflight  # CLI, config, duplicate-version, and Docker checks
npm run test:db            # pinned CLI; local start/reset/test only
```

The wrapper:

- accepts only `--preflight-only` and rejects all remote/unknown arguments;
- pins Supabase CLI `2.108.0` through npm's cache rather than requiring a global install;
- requires `project_id = "daybreak-local"` and rejects the production ref in local config;
- reports both duplicate migration versions and Docker availability;
- forces `db reset --local` and `test db --local`;
- stops and removes only the disposable local services it started; and
- never runs a linked reset, `db push`, or migration repair.

The current duplicate `0021` files intentionally make preflight nonzero until
the approved reconciliation plan addresses fresh-install ordering. Do not
bypass that failure merely to make the suite green.

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
