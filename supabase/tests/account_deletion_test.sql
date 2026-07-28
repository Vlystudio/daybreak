-- Durable queue authorization, claim locking, and post-Auth receipt behavior.
BEGIN;
SELECT plan(15);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) VALUES (
  '50000000-0000-0000-0000-000000000005'::uuid,
  'authenticated', 'authenticated', 'deletion@example.invalid', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Deletion Test","adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,
  now(), now()
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
SELECT throws_ok(
  $$ SELECT public.queue_account_deletion_job(
    '50000000-0000-0000-0000-000000000005',
    'user_request',
    repeat('a', 64)
  ) $$,
  '42501',
  'service role required',
  'a browser-authenticated caller cannot invoke the trusted deletion queue RPC'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT ok(
  public.queue_account_deletion_job(
    '50000000-0000-0000-0000-000000000005',
    'user_request',
    repeat('a', 64)
  ) IS NOT NULL,
  'trusted server queues account deletion'
);
SELECT is(
  (SELECT status FROM public.account_eligibility
   WHERE user_id = '50000000-0000-0000-0000-000000000005'),
  'deletion_pending',
  'queueing atomically disables the account'
);
SELECT is(
  (SELECT status_token_hash FROM public.account_deletion_jobs
   WHERE user_id = '50000000-0000-0000-0000-000000000005'),
  repeat('a', 64),
  'only the deletion capability hash is stored'
);
SELECT is(
  (SELECT count(*)::int FROM public.claim_account_deletion_job(
    (SELECT id FROM public.account_deletion_jobs
     WHERE user_id = '50000000-0000-0000-0000-000000000005')
  )),
  1,
  'one worker atomically claims the job'
);
SELECT is(
  (SELECT attempts FROM public.account_deletion_jobs
   WHERE user_id = '50000000-0000-0000-0000-000000000005'),
  1,
  'claim records the attempt'
);
SELECT is(
  (SELECT count(*)::int FROM public.claim_account_deletion_job(
    (SELECT id FROM public.account_deletion_jobs
     WHERE user_id = '50000000-0000-0000-0000-000000000005')
  )),
  0,
  'an active lock prevents a concurrent second worker claim'
);

INSERT INTO public.account_deletion_receipts (
  deletion_job_id, status_token_hash, subject_hash, reason, status,
  requested_at, started_at, completed_at
) SELECT id, status_token_hash, repeat('b', 64), reason, 'processing',
         requested_at, now(), null
  FROM public.account_deletion_jobs
  WHERE user_id = '50000000-0000-0000-0000-000000000005';

RESET ROLE;
DELETE FROM auth.users WHERE id = '50000000-0000-0000-0000-000000000005';
SELECT is(
  (SELECT count(*)::int FROM public.profiles
   WHERE id = '50000000-0000-0000-0000-000000000005'),
  0,
  'Auth deletion cascades the user profile'
);
SELECT is(
  (SELECT count(*)::int FROM public.account_deletion_jobs
   WHERE user_id = '50000000-0000-0000-0000-000000000005'),
  1,
  'the working job survives Auth deletion for retryable receipt finalization'
);
SELECT is(
  (SELECT status FROM public.account_deletion_receipts
   WHERE subject_hash = repeat('b', 64)),
  'processing',
  'the receipt is not falsely completed by Auth deletion alone'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.complete_account_deletion_job(
    (SELECT id FROM public.account_deletion_jobs
     WHERE user_id = '50000000-0000-0000-0000-000000000005'),
    now(),
    '{"authentication account and sessions":"complete"}'::jsonb
  ) $$,
  '42501',
  'service role required',
  'a browser-authenticated caller cannot finalize a deletion job'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$ SELECT public.complete_account_deletion_job(
    (SELECT id FROM public.account_deletion_jobs
     WHERE user_id = '50000000-0000-0000-0000-000000000005'),
    now(),
    '{"authentication account and sessions":"complete"}'::jsonb
  ) $$,
  'the trusted worker atomically finalizes the receipt and removes the job'
);

SELECT is(
  (SELECT count(*)::int FROM public.account_deletion_jobs
   WHERE user_id = '50000000-0000-0000-0000-000000000005'),
  0,
  'finalization removes the working job and raw user id'
);
SELECT is(
  (SELECT status FROM public.account_deletion_receipts
   WHERE subject_hash = repeat('b', 64)),
  'completed',
  'non-identifying completion receipt remains after finalization'
);
SELECT ok(
  (SELECT completed_at is not null FROM public.account_deletion_receipts
   WHERE subject_hash = repeat('b', 64)),
  'completion receipt has an explicit completion timestamp'
);

SELECT * FROM finish();
ROLLBACK;
