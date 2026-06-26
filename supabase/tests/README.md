# Database tests (RLS isolation)

These pgTAP tests assert that Row-Level Security keeps each user's data private —
the single most important safety property of this app. **Run them in CI and
before any migration that touches policies.**

## One-time setup

Install the [Supabase test helpers](https://github.com/usebasejump/supabase-test-helpers)
(they provide `tests.create_supabase_user`, `tests.authenticate_as`, etc.):

```bash
# from the project root, against the LOCAL dev database
supabase start
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f path/to/supabase_test_helpers.sql
```

(Or commit the helpers as a `*_test_helpers.sql` file that only runs locally.)

## Run

```bash
npm run test:db        # = supabase test db
```

This spins up the local Postgres, applies all migrations, and runs every
`supabase/tests/*.sql` file. A failing assertion = an RLS regression; treat it
as a release blocker.

## What's covered

- `rls_isolation_test.sql` — user A cannot read user B's `health_metrics`,
  `daily_summaries`, `schedule_events`, or `subjective_checkins`, and each user
  sees exactly their own rows.

Extend it as you add tables: every table holding user data should have an
isolation assertion here.
