-- Rights requests are subject-bound; retention is service-only and dry-run safe.
BEGIN;
SELECT plan(14);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '81000000-0000-0000-0000-000000000081'::uuid,
    'authenticated', 'authenticated', 'rights-one@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Rights One","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  ),
  (
    '82000000-0000-0000-0000-000000000082'::uuid,
    'authenticated', 'authenticated', 'rights-two@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Rights Two","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000081","role":"authenticated"}',
  true
);
CREATE TEMP TABLE request_state AS
  SELECT public.create_current_user_privacy_rights_request(
    'access', 'consumer_health', 'US-WA', 30, null
  ) AS id;
SELECT ok((SELECT id FROM request_state) IS NOT NULL, 'authenticated user creates own rights request');
SELECT is(
  (SELECT status FROM public.privacy_rights_requests WHERE id = (SELECT id FROM request_state)),
  'submitted',
  'request starts in submitted status'
);
SELECT is(
  (SELECT count(*)::int FROM public.privacy_rights_request_events
   WHERE request_id = (SELECT id FROM request_state)),
  1,
  'an auditable status event is written atomically'
);
SELECT throws_ok(
  $$ INSERT INTO public.privacy_rights_requests (
    user_id, request_type, scope, deadline_at
  ) VALUES (
    '82000000-0000-0000-0000-000000000082', 'access', 'consumer_health', now() + interval '30 days'
  ) $$,
  '42501', null,
  'browser cannot directly create a request for another subject'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"82000000-0000-0000-0000-000000000082","role":"authenticated"}',
  true
);
SELECT is(
  (SELECT count(*)::int FROM public.privacy_rights_requests),
  0,
  'another user cannot read the request'
);
SELECT throws_ok(
  format(
    'SELECT public.create_current_user_privacy_rights_request(%L,%L,%L,%s,%L::uuid)',
    'appeal', 'consumer_health', 'US-WA', 30, (SELECT id::text FROM request_state)
  ),
  '42501', 'appeal target unavailable',
  'another user cannot appeal or infer a request'
);
SELECT throws_ok(
  $$ SELECT * FROM public.run_retention_maintenance(true) $$,
  '42501', 'service role required',
  'browser cannot execute retention maintenance'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT ok(
  public.update_privacy_rights_request_status(
    (SELECT id FROM request_state), 'denied', 'identity_unconfirmed', '{}'::jsonb
  ),
  'trusted workflow records a decision'
);
INSERT INTO public.rate_limits (key, window_start, count)
VALUES ('retention-test', now() - interval '3 days', 1);
SELECT is(
  (SELECT matched_rows::int FROM public.run_retention_maintenance(true)
   WHERE category = 'expired_rate_limits'),
  1,
  'dry run reports expired rows'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.rate_limits WHERE key = 'retention-test'),
  'dry run does not delete rows'
);
SELECT is(
  (SELECT deleted_rows::int FROM public.run_retention_maintenance(false)
   WHERE category = 'expired_rate_limits'),
  1,
  'write mode deletes only matching expired rows'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.rate_limits WHERE key = 'retention-test'),
  'expired row is gone after explicit write mode'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000081","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT ok(
  public.create_current_user_privacy_rights_request(
    'appeal', 'consumer_health', 'US-WA', 30, (SELECT id FROM request_state)
  ) IS NOT NULL,
  'the original subject can appeal a denied request'
);
SELECT is(
  (SELECT count(*)::int FROM public.privacy_rights_requests WHERE request_type = 'appeal'),
  1,
  'appeal is visible to its subject'
);

SELECT * FROM finish();
ROLLBACK;
