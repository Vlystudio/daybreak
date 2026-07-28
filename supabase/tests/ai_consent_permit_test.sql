-- Granular consent, immutable history, purpose/user/epoch/expiry permit checks.
BEGIN;
SELECT plan(18);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '60000000-0000-0000-0000-000000000006'::uuid,
    'authenticated', 'authenticated', 'ai-one@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"AI One","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000007'::uuid,
    'authenticated', 'authenticated', 'ai-two@example.invalid', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"AI Two","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
    now(), now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
SELECT ok(
  public.set_current_user_ai_consent(
    true, true, false, false, true, false, true, false,
    '2026-07-28', 'web-0.1.0', 'web'
  ) > 0,
  'user records a granular affirmative decision'
);
SELECT is(
  (SELECT allow_ai_health_context FROM public.user_preferences
   WHERE user_id = '60000000-0000-0000-0000-000000000006'),
  false,
  'unselected health context remains denied'
);
SELECT is(
  (SELECT count(*)::int FROM public.ai_consent_history),
  1,
  'minimal immutable consent history is created'
);
SELECT throws_ok(
  $$ SELECT * FROM public.issue_ai_processing_permit(
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic'], repeat('a', 64)
  ) $$,
  '42501', 'service role required',
  'browser clients cannot mint permits'
);
SELECT throws_ok(
  $$ SELECT public.set_current_user_ai_consent(
    true, false, false, false, false, true, false, false,
    '2026-07-28', 'web-0.1.0', 'web'
  ) $$,
  '22023', 'invalid AI consent decision',
  'calendar detail cannot bypass calendar availability'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE permit_state AS
  SELECT * FROM public.issue_ai_processing_permit(
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  );
SELECT is((SELECT count(*)::int FROM permit_state), 1, 'trusted gateway mints one permit');
SELECT throws_ok(
  $$ SELECT * FROM public.issue_ai_processing_permit(
    '60000000-0000-0000-0000-000000000006', 'health_analysis',
    array['basic','health'], repeat('b', 64)
  ) $$,
  '42501', 'AI category not permitted',
  'health consent cannot be inferred from basic consent'
);
SELECT ok(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM permit_state),
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  ),
  'correct user, purpose, categories, and nonce consume a use'
);
SELECT is(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM permit_state),
    '60000000-0000-0000-0000-000000000006', 'daily_plan',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  ),
  false,
  'permit cannot be broadened to another purpose'
);
SELECT is(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM permit_state),
    '70000000-0000-0000-0000-000000000007', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  ),
  false,
  'permit cannot be used for another user'
);
SELECT ok(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM permit_state),
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  ),
  'bounded second call is allowed for one feature request'
);
SELECT is(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM permit_state),
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('a', 64)
  ),
  false,
  'permit replay beyond its use budget is denied'
);

CREATE TEMP TABLE revoked_permit AS
  SELECT * FROM public.issue_ai_processing_permit(
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('c', 64)
  );
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT ok(
  public.set_current_user_ai_consent(
    true, true, false, false, false, false, true, false,
    '2026-07-28', 'web-0.1.0', 'web'
  ) > (SELECT consent_epoch FROM revoked_permit),
  'revocation increments the consent epoch'
);
SELECT is(
  (SELECT event_type FROM public.ai_consent_history ORDER BY recorded_at DESC LIMIT 1),
  'category_revoked',
  'revocation is preserved in consent history'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT is(
  public.consume_ai_processing_permit(
    (SELECT permit_id FROM revoked_permit),
    '60000000-0000-0000-0000-000000000006', 'morning_briefing',
    array['basic','tasks','calendar_availability','profile'], repeat('c', 64)
  ),
  false,
  'revoked permit cannot be consumed'
);
SELECT is(
  (SELECT count(*)::int FROM public.ai_processing_permits
   WHERE user_id = '60000000-0000-0000-0000-000000000006'),
  0,
  'consent update clears every outstanding permit'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT ok(
  public.set_current_user_ai_consent(
    false, false, false, true, false, false, false, false,
    '2026-07-28', 'web-0.1.0', 'web'
  ) > 0,
  'health may be recorded independently while basic AI is off'
);
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ SELECT * FROM public.issue_ai_processing_permit(
    '60000000-0000-0000-0000-000000000006', 'health_analysis',
    array['basic','health'], repeat('d', 64)
  ) $$,
  '42501', 'current AI consent required',
  'health without basic AI cannot issue a permit'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
