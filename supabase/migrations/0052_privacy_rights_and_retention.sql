-- Authenticated privacy/consumer-health rights workflow and production-safe
-- retention maintenance. Clients cannot choose another subject or alter status.

create table public.privacy_rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_type text not null check (request_type in (
    'confirmation', 'access', 'correction', 'deletion',
    'withdraw_consent', 'cease_collection', 'cease_sharing',
    'third_party_list', 'appeal'
  )),
  scope text not null check (scope in ('consumer_health', 'all_personal_data')),
  jurisdiction_code text check (
    jurisdiction_code is null or jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
  ),
  status text not null default 'submitted' check (status in (
    'submitted', 'identity_verified', 'in_review', 'action_required',
    'fulfilled', 'denied', 'appealed', 'closed'
  )),
  requested_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  appeal_of uuid references public.privacy_rights_requests (id) on delete set null,
  processor_propagation_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(processor_propagation_state) = 'object'),
  outcome_code text,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status in ('fulfilled', 'denied', 'closed') and resolved_at is not null)
    or status not in ('fulfilled', 'denied', 'closed')),
  check ((request_type = 'appeal' and appeal_of is not null)
    or (request_type <> 'appeal' and appeal_of is null))
);

alter table public.privacy_rights_requests enable row level security;
create policy "privacy rights: read own" on public.privacy_rights_requests
  for select using ((select auth.uid()) = user_id);
create policy "privacy rights: eligible accounts only" on public.privacy_rights_requests
  as restrictive for all to authenticated
  using (public.is_current_user_eligible())
  with check (public.is_current_user_eligible());
create index privacy_rights_requests_user_idx
  on public.privacy_rights_requests (user_id, requested_at desc);
create index privacy_rights_requests_deadline_idx
  on public.privacy_rights_requests (status, deadline_at)
  where status not in ('fulfilled', 'denied', 'closed');
create trigger touch_privacy_rights_requests
  before update on public.privacy_rights_requests
  for each row execute function public.touch_updated_at();

create table public.privacy_rights_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.privacy_rights_requests (id) on delete cascade,
  event_type text not null check (event_type in (
    'submitted', 'identity_verified', 'status_changed',
    'processor_propagated', 'appeal_submitted'
  )),
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.privacy_rights_request_events enable row level security;
create policy "privacy rights events: read own" on public.privacy_rights_request_events
  for select using (exists (
    select 1 from public.privacy_rights_requests request
    where request.id = request_id and request.user_id = (select auth.uid())
  ));
create policy "privacy rights events: eligible accounts only"
  on public.privacy_rights_request_events
  as restrictive for select to authenticated
  using (public.is_current_user_eligible());

create or replace function public.create_current_user_privacy_rights_request(
  p_request_type text,
  p_scope text,
  p_jurisdiction_code text default null,
  p_deadline_days integer default 30,
  p_appeal_of uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if not public.is_current_user_eligible() then
    raise exception using errcode = '42501', message = 'eligible account required';
  end if;
  if p_request_type not in (
    'confirmation', 'access', 'correction', 'deletion',
    'withdraw_consent', 'cease_collection', 'cease_sharing',
    'third_party_list', 'appeal'
  ) or p_scope not in ('consumer_health', 'all_personal_data')
    or p_deadline_days not between 1 and 90
    or (p_jurisdiction_code is not null and p_jurisdiction_code !~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$')
  then
    raise exception using errcode = '22023', message = 'invalid privacy rights request';
  end if;

  if p_request_type = 'appeal' then
    if not exists (
      select 1 from public.privacy_rights_requests
      where id = p_appeal_of and user_id = current_user_id and status = 'denied'
    ) then
      raise exception using errcode = '42501', message = 'appeal target unavailable';
    end if;
  elsif p_appeal_of is not null then
    raise exception using errcode = '22023', message = 'appeal target is not allowed';
  end if;

  insert into public.privacy_rights_requests (
    user_id, request_type, scope, jurisdiction_code,
    deadline_at, appeal_of, status
  ) values (
    current_user_id, p_request_type, p_scope, p_jurisdiction_code,
    now() + make_interval(days => p_deadline_days), p_appeal_of,
    case when p_request_type = 'appeal' then 'appealed' else 'submitted' end
  ) returning id into new_request_id;

  insert into public.privacy_rights_request_events (request_id, event_type, status)
  values (
    new_request_id,
    case when p_request_type = 'appeal' then 'appeal_submitted' else 'submitted' end,
    case when p_request_type = 'appeal' then 'appealed' else 'submitted' end
  );
  return new_request_id;
end;
$$;

revoke all on function public.create_current_user_privacy_rights_request(
  text, text, text, integer, uuid
) from public, anon;
grant execute on function public.create_current_user_privacy_rights_request(
  text, text, text, integer, uuid
) to authenticated;

create or replace function public.update_privacy_rights_request_status(
  p_request_id uuid,
  p_status text,
  p_outcome_code text default null,
  p_processor_state jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_status not in (
    'identity_verified', 'in_review', 'action_required',
    'fulfilled', 'denied', 'closed'
  ) or jsonb_typeof(p_processor_state) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid rights status update';
  end if;

  update public.privacy_rights_requests
  set status = p_status,
      outcome_code = p_outcome_code,
      processor_propagation_state = p_processor_state,
      resolved_at = case when p_status in ('fulfilled', 'denied', 'closed') then now() else null end
  where id = p_request_id;
  get diagnostics changed = row_count;
  if changed = 1 then
    insert into public.privacy_rights_request_events (request_id, event_type, status)
    values (p_request_id, 'status_changed', p_status);
  end if;
  return changed = 1;
end;
$$;

revoke all on function public.update_privacy_rights_request_status(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_privacy_rights_request_status(uuid, text, text, jsonb)
  to service_role;

create table public.retention_job_runs (
  id uuid primary key default gen_random_uuid(),
  dry_run boolean not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.retention_job_runs enable row level security;
-- Service role only; retention runs can contain security-oriented counts.

create or replace function public.run_retention_maintenance(p_dry_run boolean default true)
returns table (category text, matched_rows bigint, deleted_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  matched bigint;
  deleted bigint;
  result_summary jsonb := '{}'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  insert into public.retention_job_runs (dry_run) values (p_dry_run) returning id into run_id;

  select count(*) into matched from public.ai_processing_permits
    where expires_at < now() - interval '1 hour';
  deleted := 0;
  if not p_dry_run then
    delete from public.ai_processing_permits where expires_at < now() - interval '1 hour';
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_ai_permits'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  select count(*) into matched from public.ai_generation_cache
    where created_at < now() - interval '2 hours';
  deleted := 0;
  if not p_dry_run then
    delete from public.ai_generation_cache where created_at < now() - interval '2 hours';
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_ai_cache'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  select count(*) into matched from public.rate_limits
    where window_start < now() - interval '2 days';
  deleted := 0;
  if not p_dry_run then
    delete from public.rate_limits where window_start < now() - interval '2 days';
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_rate_limits'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  select count(*) into matched from public.account_deletion_receipts where expires_at < now();
  deleted := 0;
  if not p_dry_run then
    delete from public.account_deletion_receipts where expires_at < now();
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_deletion_receipts'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  select count(*) into matched from public.analytics_events
    where created_at < now() - interval '365 days';
  deleted := 0;
  if not p_dry_run then
    delete from public.analytics_events where created_at < now() - interval '365 days';
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_product_analytics'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  select count(*) into matched from public.audit_logs
    where user_id is null and created_at < now() - interval '365 days';
  deleted := 0;
  if not p_dry_run then
    delete from public.audit_logs where user_id is null and created_at < now() - interval '365 days';
    get diagnostics deleted = row_count;
  end if;
  category := 'expired_anonymous_audit'; matched_rows := matched; deleted_rows := deleted; return next;
  result_summary := result_summary || jsonb_build_object(category, matched);

  update public.retention_job_runs
  set status = 'completed', summary = result_summary, completed_at = now()
  where id = run_id;
exception when others then
  update public.retention_job_runs
  set status = 'failed', completed_at = now()
  where id = run_id;
  raise;
end;
$$;

revoke all on function public.run_retention_maintenance(boolean)
  from public, anon, authenticated;
grant execute on function public.run_retention_maintenance(boolean) to service_role;
