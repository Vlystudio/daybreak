-- Catalog-wide and representative runtime security assertions (pgTAP).
-- Fixtures are synthetic, isolated in this transaction, and always rolled back.

BEGIN;
SELECT plan(30);

SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')),
  75::bigint,
  'the reviewed public base-table inventory contains exactly 75 tables'
);
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity),
  0::bigint,
  'RLS is enabled on every public base table'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND NOT coalesce(p.proconfig, '{}'::text[]) @> ARRAY['search_path=public']
  ),
  'every public SECURITY DEFINER function fixes search_path to public'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      AND NOT coalesce(c.reloptions, '{}'::text[]) @> ARRAY['security_invoker=true']
  ),
  'public views are absent or use invoker security'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  ),
  'no protected public table is published to realtime without an explicit review'
);
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'avatars'),
  true,
  'the intentional public avatar bucket is declared explicitly'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '61000000-0000-0000-0000-000000000061', 'authenticated', 'authenticated',
    'alice.surface-test@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  ),
  (
    '62000000-0000-0000-0000-000000000062', 'authenticated', 'authenticated',
    'bob.surface-test@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  );

INSERT INTO public.schedule_events (id, user_id, title, starts_at, ends_at)
VALUES (
  '61100000-0000-0000-0000-000000000061',
  '61000000-0000-0000-0000-000000000061',
  'Alice private event', now(), now() + interval '1 hour'
);
INSERT INTO public.health_observations (user_id, source, metric, value_numeric, date_local)
VALUES ('61000000-0000-0000-0000-000000000061', 'oura', 'steps', 1000, current_date);
INSERT INTO public.oauth_connections (user_id, provider, access_token_enc)
VALUES ('61000000-0000-0000-0000-000000000061', 'oura', 'synthetic-ciphertext');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT is((SELECT count(*) FROM public.profiles)::int, 0, 'anon cannot read profiles');
SELECT is((SELECT count(*) FROM public.account_eligibility)::int, 0, 'anon cannot read eligibility records');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"62000000-0000-0000-0000-000000000062","role":"authenticated"}',
  true
);
SELECT is((SELECT count(*) FROM public.schedule_events)::int, 0, 'Bob cannot select Alice event');
SELECT is(
  (WITH changed AS (
    UPDATE public.schedule_events SET title = 'forged update'
    WHERE id = '61100000-0000-0000-0000-000000000061' RETURNING 1
  ) SELECT count(*)::int FROM changed),
  0,
  'Bob cannot update Alice event'
);
SELECT is(
  (WITH removed AS (
    DELETE FROM public.schedule_events
    WHERE id = '61100000-0000-0000-0000-000000000061' RETURNING 1
  ) SELECT count(*)::int FROM removed),
  0,
  'Bob cannot delete Alice event'
);
SELECT throws_ok(
  $$ INSERT INTO public.schedule_events (user_id, title, starts_at, ends_at)
     VALUES ('61000000-0000-0000-0000-000000000061', 'forged owner', now(), now() + interval '1 hour') $$,
  '42501', null,
  'Bob cannot forge Alice ownership on insert'
);
SELECT throws_ok(
  $$ INSERT INTO public.health_observations (user_id, source, metric, value_numeric, date_local)
     VALUES ('62000000-0000-0000-0000-000000000062', 'oura', 'steps', 999999, current_date) $$,
  '42501', null,
  'authenticated clients cannot forge provider health observations'
);
SELECT is((SELECT count(*) FROM public.oauth_connections)::int, 0, 'OAuth secrets remain service-only');
SELECT is((SELECT count(*) FROM public.ai_processing_permits)::int, 0, 'AI permits remain service-only');
SELECT is((SELECT count(*) FROM public.profiles)::int, 1, 'eligible Bob can read only his own protected profile');
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner_id)
     VALUES ('avatars', '62000000-0000-0000-0000-000000000062/forged.png',
             '62000000-0000-0000-0000-000000000062') $$,
  '42501', null,
  'authenticated clients cannot write storage objects directly'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.schedule_events
   WHERE id = '61100000-0000-0000-0000-000000000061' AND title = 'Alice private event'),
  1,
  'cross-user attempts leave Alice event unchanged'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.queue_account_deletion_job(uuid,text,text)', 'EXECUTE'),
  'deletion queue RPC is not executable by authenticated clients'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_account_deletion_job(uuid)', 'EXECUTE'),
  'deletion claim RPC is not executable by authenticated clients'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.issue_ai_processing_permit(uuid,text,text[],text)', 'EXECUTE'),
  'AI permit issue RPC is not executable by authenticated clients'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.consume_ai_processing_permit(uuid,uuid,text,text[],text)', 'EXECUTE'),
  'AI permit consume RPC is not executable by authenticated clients'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.run_retention_maintenance(boolean)', 'EXECUTE'),
  'retention worker RPC is not executable by authenticated clients'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.update_privacy_rights_request_status(uuid,text,text,jsonb)', 'EXECUTE'),
  'privacy status worker RPC is not executable by authenticated clients'
);
SELECT ok(
  has_function_privilege('service_role', 'public.queue_account_deletion_job(uuid,text,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.issue_ai_processing_permit(uuid,text,text[],text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.run_retention_maintenance(boolean)', 'EXECUTE'),
  'service role retains required worker RPC privileges'
);

UPDATE public.account_eligibility SET status = 'pending_adult_attestation'
WHERE user_id = '62000000-0000-0000-0000-000000000062';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"62000000-0000-0000-0000-000000000062","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.profiles)::int, 0, 'pending account loses protected access');
RESET ROLE;

UPDATE public.account_eligibility SET status = 'restricted_minor'
WHERE user_id = '62000000-0000-0000-0000-000000000062';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles)::int, 0, 'restricted minor loses protected access');
RESET ROLE;

UPDATE public.account_eligibility SET status = 'suspended'
WHERE user_id = '62000000-0000-0000-0000-000000000062';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles)::int, 0, 'suspended account loses protected access');
RESET ROLE;

UPDATE public.account_eligibility SET status = 'deletion_pending'
WHERE user_id = '62000000-0000-0000-0000-000000000062';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles)::int, 0, 'deletion-pending account loses protected access');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT count(*) FROM public.schedule_events
   WHERE id = '61100000-0000-0000-0000-000000000061')::int,
  1,
  'service role can perform required server-side cleanup reads'
);

SELECT * FROM finish();
ROLLBACK;
