-- Row-Level-Security isolation tests (pgTAP).
--
-- Self-contained: the transaction creates two synthetic auth users, seeds rows
-- as the database owner, switches to the local `authenticated` role, and sets
-- the same JWT claims that PostgREST supplies. ROLLBACK removes every fixture.
-- No external test-helper extension or production credential is required.

BEGIN;
SELECT plan(8);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'authenticated',
    'authenticated',
    'alice.rls-test@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    'authenticated',
    'authenticated',
    'bob.rls-test@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(),
    now()
  );

-- Seed Alice's data as the database owner so setup does not depend on the
-- policies being tested.
INSERT INTO public.health_metrics (user_id, date, readiness_score)
VALUES ('10000000-0000-0000-0000-000000000001'::uuid, current_date, 80);

INSERT INTO public.daily_summaries (user_id, date, summary)
VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  current_date,
  'Alice morning summary'
);

INSERT INTO public.schedule_events (user_id, title, starts_at, ends_at, all_day)
VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Alice event',
  now(),
  now() + interval '1 hour',
  false
);

INSERT INTO public.subjective_checkins (user_id, date, mood)
VALUES ('10000000-0000-0000-0000-000000000001'::uuid, current_date, 4);

SET LOCAL ROLE authenticated;

-- Bob must see none of Alice's rows.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT is((SELECT count(*) FROM public.health_metrics)::int, 0, 'Bob cannot read health_metrics');
SELECT is((SELECT count(*) FROM public.daily_summaries)::int, 0, 'Bob cannot read daily_summaries');
SELECT is((SELECT count(*) FROM public.schedule_events)::int, 0, 'Bob cannot read schedule_events');
SELECT is((SELECT count(*) FROM public.subjective_checkins)::int, 0, 'Bob cannot read subjective_checkins');

-- Alice sees exactly her own rows.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT is((SELECT count(*) FROM public.health_metrics)::int, 1, 'Alice reads her health_metrics');
SELECT is((SELECT count(*) FROM public.daily_summaries)::int, 1, 'Alice reads her daily_summaries');
SELECT is((SELECT count(*) FROM public.schedule_events)::int, 1, 'Alice reads her schedule_events');
SELECT is((SELECT count(*) FROM public.subjective_checkins)::int, 1, 'Alice reads her subjective_checkins');

SELECT * FROM finish();
ROLLBACK;
