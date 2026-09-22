-- Durable, retryable account deletion with an opaque user-visible receipt.
-- The capability token is never stored; only its SHA-256 hash is persisted.

alter table public.account_deletion_jobs
  add column status_token_hash text,
  add column step_state jsonb not null default '{}'::jsonb,
  add column provider_revocation jsonb not null default '{}'::jsonb,
  add column locked_at timestamptz,
  add column last_error_code text;

-- The operational job must survive Auth deletion long enough to finalize its
-- non-identifying receipt. It is deleted atomically by the service-only
-- completion RPC below; retaining it briefly also makes a lost worker response
-- retryable after the Auth account has already gone.
alter table public.account_deletion_jobs
  drop constraint account_deletion_jobs_user_id_fkey;

alter table public.account_deletion_jobs
  add constraint account_deletion_jobs_status_token_hash_format
  check (status_token_hash is null or status_token_hash ~ '^[a-f0-9]{64}$'),
  add constraint account_deletion_jobs_step_state_object
  check (jsonb_typeof(step_state) = 'object'),
  add constraint account_deletion_jobs_provider_revocation_object
  check (jsonb_typeof(provider_revocation) = 'object');

create unique index account_deletion_jobs_status_token_hash_idx
  on public.account_deletion_jobs (status_token_hash)
  where status_token_hash is not null;

create policy "eligible accounts only" on public.account_deletion_jobs
  as restrictive for all to authenticated
  using (public.is_current_user_eligible())
  with check (public.is_current_user_eligible());

-- Receipts intentionally have no auth.users foreign key or raw user id. They
-- remain available through an unguessable capability after Auth deletion and
-- atomic job finalization. The subject hash is operational evidence, not
-- a login identifier, and must not be exposed by public APIs.
create table public.account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  deletion_job_id uuid not null unique,
  status_token_hash text unique,
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  reason text not null check (reason in ('user_request', 'known_minor', 'admin_required')),
  status text not null check (status in ('processing', 'completed', 'blocked')),
  step_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(step_summary) = 'object'),
  requested_at timestamptz not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '45 days'),
  updated_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

alter table public.account_deletion_receipts enable row level security;
-- No client policy: receipts are capability-checked by trusted server code.

create index account_deletion_receipts_expiry_idx
  on public.account_deletion_receipts (expires_at);
create trigger touch_account_deletion_receipts
  before update on public.account_deletion_receipts
  for each row execute function public.touch_updated_at();

-- Atomic claim prevents two workers from running the same deletion at once.
-- A crashed claim becomes eligible again after 15 minutes.
create or replace function public.claim_account_deletion_job(p_job_id uuid)
returns table (job_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update public.account_deletion_jobs as jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      started_at = coalesce(jobs.started_at, now()),
      locked_at = now(),
      last_error_class = null,
      last_error_code = null
  where jobs.id = p_job_id
    and jobs.next_attempt_at <= now()
    and (
      jobs.status in ('pending', 'retry_wait')
      or (jobs.status = 'processing' and jobs.locked_at < now() - interval '15 minutes')
    )
  returning jobs.id, jobs.user_id;
end;
$$;

revoke all on function public.claim_account_deletion_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job(uuid) to service_role;

-- Receipt completion and deletion of the now-unneeded raw user id happen in a
-- single transaction. If this function fails, the job remains claimable and a
-- retry can safely observe that Auth deletion already succeeded.
create or replace function public.complete_account_deletion_job(
  p_job_id uuid,
  p_completed_at timestamptz,
  p_step_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_receipts integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_completed_at is null or jsonb_typeof(p_step_summary) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid completion evidence';
  end if;
  if not exists (
    select 1 from public.account_deletion_jobs where id = p_job_id
  ) then
    raise exception using errcode = 'P0002', message = 'deletion job not found';
  end if;

  update public.account_deletion_receipts
  set status = 'completed',
      completed_at = p_completed_at,
      step_summary = p_step_summary
  where deletion_job_id = p_job_id;
  get diagnostics updated_receipts = row_count;
  if updated_receipts <> 1 then
    raise exception using errcode = 'P0002', message = 'deletion receipt not found';
  end if;

  delete from public.account_deletion_jobs where id = p_job_id;
end;
$$;

revoke all on function public.complete_account_deletion_job(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_account_deletion_job(uuid, timestamptz, jsonb)
  to service_role;

-- Queueing and restricting the account happen in one transaction. Requiring
-- service_role keeps recent-authentication enforcement in the trusted server
-- action instead of exposing a directly callable destructive RPC.
create or replace function public.queue_account_deletion_job(
  p_user_id uuid,
  p_reason text,
  p_status_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_job_id uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_reason not in ('user_request', 'known_minor', 'admin_required')
    or (p_status_token_hash is not null and p_status_token_hash !~ '^[a-f0-9]{64}$')
    or (p_reason = 'user_request' and p_status_token_hash is null)
  then
    raise exception using errcode = '22023', message = 'invalid deletion request';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'account does not exist';
  end if;

  update public.account_eligibility
  set status = 'deletion_pending',
      consent_epoch = consent_epoch + 1
  where user_id = p_user_id;

  insert into public.account_deletion_jobs (
    user_id, reason, status_token_hash, status, current_step, next_attempt_at
  ) values (
    p_user_id, p_reason, p_status_token_hash, 'pending', 'queued', now()
  )
  on conflict (user_id) where status in ('pending', 'processing', 'retry_wait', 'blocked')
  do update set
    status_token_hash = coalesce(excluded.status_token_hash, public.account_deletion_jobs.status_token_hash),
    reason = case
      when public.account_deletion_jobs.reason = 'known_minor' then 'known_minor'
      else excluded.reason
    end,
    status = case
      when public.account_deletion_jobs.status = 'processing' then 'processing'
      else 'pending'
    end,
    next_attempt_at = now(),
    last_error_class = null,
    last_error_code = null
  returning id into queued_job_id;

  return queued_job_id;
end;
$$;

revoke all on function public.queue_account_deletion_job(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.queue_account_deletion_job(uuid, text, text) to service_role;

-- Existing restricted-minor jobs must never be made user-visible by inventing
-- a token; a later trusted worker can still process them normally.
