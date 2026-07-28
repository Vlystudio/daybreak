-- Adult-only auth trigger, existing-user gate, and direct-RPC bypass tests.
BEGIN;
SELECT plan(17);

SELECT throws_ok(
  $$
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '30000000-0000-0000-0000-000000000003'::uuid,
      'authenticated', 'authenticated', 'no-attestation@example.invalid', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now()
    )
  $$,
  '23514',
  'current explicit adult attestation and legal acceptance are required',
  'auth insert without attestation is rejected transactionally'
);
SELECT is(
  (SELECT count(*)::int FROM auth.users WHERE id = '30000000-0000-0000-0000-000000000003'),
  0,
  'rejected signup creates no auth user'
);

SELECT throws_ok(
  $$
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '31000000-0000-0000-0000-000000000031'::uuid,
      'authenticated', 'authenticated', 'oauth-no-attestation@example.invalid', '',
      '{"provider":"google","providers":["google"]}'::jsonb,
      '{}', now(), now()
    )
  $$,
  '23514',
  'current explicit adult attestation and legal acceptance are required',
  'social OAuth signup cannot bypass adult and legal acceptance'
);
SELECT throws_ok(
  $$
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '32000000-0000-0000-0000-000000000032'::uuid,
      'authenticated', 'authenticated', 'apple-no-attestation@example.invalid', '',
      '{"provider":"apple","providers":["apple"]}'::jsonb,
      '{}', now(), now()
    )
  $$,
  '23514',
  'current explicit adult attestation and legal acceptance are required',
  'Sign in with Apple cannot bypass adult and legal acceptance if later enabled'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) VALUES (
  '40000000-0000-0000-0000-000000000004'::uuid,
  'authenticated', 'authenticated', 'eligible@example.invalid', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Eligible Test","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = '40000000-0000-0000-0000-000000000004'),
  1,
  'valid adult signup creates its profile'
);
SELECT is(
  (SELECT count(*)::int FROM public.account_eligibility
    WHERE user_id = '40000000-0000-0000-0000-000000000004' AND status = 'eligible'),
  1,
  'valid adult signup records eligible status'
);
SELECT is(
  (SELECT count(*)::int FROM public.user_legal_acceptances
    WHERE user_id = '40000000-0000-0000-0000-000000000004'),
  2,
  'valid adult signup records Terms and Privacy acceptance'
);
INSERT INTO public.oauth_connections (user_id, provider, access_token_enc, refresh_token_enc)
VALUES (
  '40000000-0000-0000-0000-000000000004',
  'google',
  'encrypted-access-fixture',
  'encrypted-refresh-fixture'
);
SELECT throws_ok(
  $$ INSERT INTO public.user_preferences (user_id, birth_year)
     VALUES ('40000000-0000-0000-0000-000000000004', 2012) $$,
  '23514', null,
  'legacy clients cannot resume collecting birth year'
);

UPDATE public.account_eligibility
SET status = 'pending_adult_attestation', adult_attested = false,
    adult_attested_at = null, adult_attestation_version = null,
    terms_version = null, privacy_version = null
WHERE user_id = '40000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.profiles),
  0,
  'pending existing user cannot read even their own protected profile'
);
SELECT throws_ok(
  $$
    INSERT INTO public.schedule_events (user_id, title, starts_at, ends_at)
    VALUES (
      '40000000-0000-0000-0000-000000000004'::uuid,
      'bypass', now(), now() + interval '1 hour'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "schedule_events"',
  'pending existing user cannot write through direct PostgREST-equivalent SQL'
);
SELECT throws_ok(
  $$
    SELECT public.complete_current_user_eligibility(
      false, '2026-07-28', '2026-07-28', '2026-07-28',
      'web-0.1.0', 'web', 'en', 'eligibility_migration'
    )
  $$,
  '22023',
  'current explicit adult and legal acceptance is required',
  'false attestation cannot complete eligibility through direct RPC'
);
SELECT ok(
  public.complete_current_user_eligibility(
    true, '2026-07-28', '2026-07-28', '2026-07-28',
    'web-0.1.0', 'web', 'en', 'eligibility_migration'
  ),
  'current explicit attestation completes eligibility for the caller only'
);
SELECT is(
  (SELECT count(*)::int FROM public.profiles),
  1,
  'newly eligible user regains protected access'
);
SELECT is(
  (SELECT count(*)::int FROM public.user_legal_acceptances),
  2,
  'eligibility migration does not duplicate current acceptances'
);

SELECT ok(public.restrict_current_user_as_minor() IS NOT NULL, 'minor restriction queues deletion');
SELECT is(
  (SELECT status FROM public.account_eligibility
    WHERE user_id = '40000000-0000-0000-0000-000000000004'),
  'restricted_minor',
  'minor restriction is immediately visible and effective'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.oauth_connections
    WHERE user_id = '40000000-0000-0000-0000-000000000004'),
  1,
  'minor restriction preserves encrypted credentials for provider-first revocation'
);

SELECT * FROM finish();
ROLLBACK;
