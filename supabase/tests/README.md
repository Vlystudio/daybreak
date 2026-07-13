# Database tests (RLS isolation)

These pgTAP tests assert that Row-Level Security keeps each user's data private.
Run them in CI and before any migration that touches policies.

## One-time local setup

The current suite calls Basejump Supabase test-helper functions such as
`tests.create_supabase_user` and `tests.authenticate_as`. Pin and install a
reviewed version of those helpers into the **local test database only** before
claiming this suite passes. The helper SQL is not vendored in this repository,
so its absence is a visible test-environment blocker.

```bash
# from the project root, against the LOCAL dev database only
npx --yes supabase@2.108.0 start
psql "$(npx --yes supabase@2.108.0 status -o env | sed -n 's/^DB_URL=//p')" \
  -v ON_ERROR_STOP=1 -f path/to/reviewed-supabase-test-helpers.sql
```

Do not install test helpers in a linked staging or production project.

## Run

```bash
npm run test:db:preflight  # configuration, Docker, and duplicate-version checks
npm run test:db            # pinned CLI; local start/reset/test only
```

The wrapper rejects remote flags and never uses the linked project. It starts
local Supabase, applies all migrations from zero, and runs every
`supabase/tests/*.sql` file. A duplicate migration version, missing helper, or
failed assertion is a release blocker. Never replace this command with a linked
reset or pass a production database URL.

## What's covered

- `rls_isolation_test.sql` - user A cannot read user B's `health_metrics`,
  `daily_summaries`, `schedule_events`, or `subjective_checkins`, and each user
  sees exactly their own rows.

Extend it as tables are added: every table holding user data should have an
isolation assertion.
