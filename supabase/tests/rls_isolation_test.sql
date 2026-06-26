-- Row-Level-Security isolation tests (pgTAP).
--
-- A missing or wrong RLS policy is the #1 breach vector for Supabase apps —
-- one user reading another user's health data. These tests fail loudly if that
-- ever regresses. They cover the most sensitive per-user tables: each user must
-- see ONLY their own rows.
--
-- Run with:  npm run test:db   (which runs `supabase test db`)
-- Requires the Supabase test helpers (one-time install):
--   https://github.com/usebasejump/supabase-test-helpers
--   psql "$DB_URL" -f supabase_test_helpers.sql   (or add it as a migration)

begin;
select plan(8);

-- Two isolated users.
select tests.create_supabase_user('alice');
select tests.create_supabase_user('bob');

-- Seed Alice's data with RLS bypassed (service role), so the test setup itself
-- isn't what we're checking.
select tests.authenticate_as_service_role();

insert into public.health_metrics (user_id, date, readiness_score)
  values (tests.get_supabase_uid('alice'), current_date, 80);

insert into public.daily_summaries (user_id, date, summary)
  values (tests.get_supabase_uid('alice'), current_date, 'Alice morning summary');

insert into public.schedule_events (user_id, title, starts_at, ends_at, all_day)
  values (tests.get_supabase_uid('alice'), 'Alice event', now(), now() + interval '1 hour', false);

insert into public.subjective_checkins (user_id, date, mood)
  values (tests.get_supabase_uid('alice'), current_date, 4);

-- As Bob: he must see NONE of Alice's rows.
select tests.authenticate_as('bob');

select is((select count(*) from public.health_metrics)::int, 0, 'Bob cannot read health_metrics');
select is((select count(*) from public.daily_summaries)::int, 0, 'Bob cannot read daily_summaries');
select is((select count(*) from public.schedule_events)::int, 0, 'Bob cannot read schedule_events');
select is((select count(*) from public.subjective_checkins)::int, 0, 'Bob cannot read subjective_checkins');

-- As Alice: she sees exactly her own rows.
select tests.authenticate_as('alice');

select is((select count(*) from public.health_metrics)::int, 1, 'Alice reads her health_metrics');
select is((select count(*) from public.daily_summaries)::int, 1, 'Alice reads her daily_summaries');
select is((select count(*) from public.schedule_events)::int, 1, 'Alice reads her schedule_events');
select is((select count(*) from public.subjective_checkins)::int, 1, 'Alice reads her subjective_checkins');

select * from finish();
rollback;
