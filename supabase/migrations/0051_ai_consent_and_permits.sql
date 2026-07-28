-- Purpose-specific AI consent and replay-bounded server permits.
-- Version 2026-07-28 deliberately does not inherit the older, broader choices.

alter table public.user_preferences
  add column allow_ai_basic_processing boolean not null default false,
  add column allow_ai_tasks_context boolean not null default false,
  add column allow_ai_calendar_availability boolean not null default false,
  add column allow_ai_calendar_detail boolean not null default false,
  add column allow_ai_profile_context boolean not null default false,
  add column allow_ai_uploads boolean not null default false,
  add column ai_consent_expires_at timestamptz;

-- All users must make a fresh decision under the granular disclosure. Keeping
-- legacy booleans false also makes older application builds fail closed.
update public.user_preferences set
  allow_ai_basic_processing = false,
  allow_ai_tasks_context = false,
  allow_ai_health_context = false,
  allow_ai_calendar_context = false,
  allow_ai_calendar_availability = false,
  allow_ai_calendar_detail = false,
  allow_ai_checkin_context = false,
  allow_ai_profile_context = false,
  allow_ai_uploads = false,
  ai_consent_version = null,
  ai_consent_updated_at = now(),
  ai_consent_expires_at = null;

create table public.ai_consent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_version text not null,
  consent_epoch bigint not null check (consent_epoch >= 0),
  event_type text not null check (event_type in (
    'decision_recorded', 'decision_updated', 'category_revoked', 'expired'
  )),
  choices jsonb not null check (jsonb_typeof(choices) = 'object'),
  application_version text not null check (char_length(application_version) between 1 and 80),
  platform text not null check (platform in ('web', 'ios')),
  recorded_at timestamptz not null default now()
);

alter table public.ai_consent_history enable row level security;
create policy "ai consent history: read own" on public.ai_consent_history
  for select using ((select auth.uid()) = user_id);
create policy "ai consent history: eligible accounts only" on public.ai_consent_history
  as restrictive for all to authenticated
  using (public.is_current_user_eligible())
  with check (public.is_current_user_eligible());
create index ai_consent_history_user_idx
  on public.ai_consent_history (user_id, recorded_at desc);

create table public.ai_processing_permits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in (
    'morning_briefing', 'daily_plan', 'health_analysis', 'health_checkin',
    'workout_plan', 'fitness_plan', 'meal_plan', 'food_image', 'receipt_image'
  )),
  allowed_categories text[] not null,
  consent_version text not null,
  consent_epoch bigint not null check (consent_epoch >= 0),
  nonce_hash text not null unique check (nonce_hash ~ '^[a-f0-9]{64}$'),
  max_uses integer not null check (max_uses between 1 and 8),
  use_count integer not null default 0 check (use_count between 0 and 8),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  check (expires_at > issued_at),
  check (cardinality(allowed_categories) between 1 and 8),
  check (allowed_categories <@ array[
    'basic', 'tasks', 'checkin', 'health', 'calendar_availability',
    'calendar_detail', 'profile', 'uploads'
  ]::text[])
);

alter table public.ai_processing_permits enable row level security;
-- No client policy. Only the trusted gateway can issue or consume permits.
create index ai_processing_permits_expiry_idx on public.ai_processing_permits (expires_at);

create or replace function public.set_current_user_ai_consent(
  p_basic boolean,
  p_tasks boolean,
  p_checkin boolean,
  p_health boolean,
  p_calendar_availability boolean,
  p_calendar_detail boolean,
  p_profile boolean,
  p_uploads boolean,
  p_consent_version text,
  p_application_version text,
  p_platform text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  next_epoch bigint;
  previous_choices jsonb;
  next_choices jsonb;
  history_event text;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if not public.is_current_user_eligible() then
    raise exception using errcode = '42501', message = 'eligible account required';
  end if;
  if p_consent_version <> '2026-07-28'
    or p_platform not in ('web', 'ios')
    or char_length(p_application_version) not between 1 and 80
    or (p_calendar_detail and not p_calendar_availability)
  then
    raise exception using errcode = '22023', message = 'invalid AI consent decision';
  end if;

  select jsonb_build_object(
    'basic', allow_ai_basic_processing,
    'tasks', allow_ai_tasks_context,
    'checkin', allow_ai_checkin_context,
    'health', allow_ai_health_context,
    'calendarAvailability', allow_ai_calendar_availability,
    'calendarDetail', allow_ai_calendar_detail,
    'profile', allow_ai_profile_context,
    'uploads', allow_ai_uploads
  ) into previous_choices
  from public.user_preferences where user_id = current_user_id;

  next_choices := jsonb_build_object(
    'basic', p_basic,
    'tasks', p_tasks,
    'checkin', p_checkin,
    'health', p_health,
    'calendarAvailability', p_calendar_availability,
    'calendarDetail', p_calendar_detail,
    'profile', p_profile,
    'uploads', p_uploads
  );

  update public.account_eligibility
  set consent_epoch = consent_epoch + 1
  where user_id = current_user_id
  returning consent_epoch into next_epoch;

  insert into public.user_preferences (
    user_id, allow_ai_basic_processing, allow_ai_tasks_context,
    allow_ai_checkin_context, allow_ai_health_context,
    allow_ai_calendar_context, allow_ai_calendar_availability,
    allow_ai_calendar_detail, allow_ai_profile_context, allow_ai_uploads,
    ai_consent_version, ai_consent_updated_at, ai_consent_expires_at
  ) values (
    current_user_id, p_basic, p_tasks, p_checkin, p_health,
    p_calendar_detail, p_calendar_availability, p_calendar_detail,
    p_profile, p_uploads, p_consent_version, now(), now() + interval '180 days'
  )
  on conflict (user_id) do update set
    allow_ai_basic_processing = excluded.allow_ai_basic_processing,
    allow_ai_tasks_context = excluded.allow_ai_tasks_context,
    allow_ai_checkin_context = excluded.allow_ai_checkin_context,
    allow_ai_health_context = excluded.allow_ai_health_context,
    allow_ai_calendar_context = excluded.allow_ai_calendar_context,
    allow_ai_calendar_availability = excluded.allow_ai_calendar_availability,
    allow_ai_calendar_detail = excluded.allow_ai_calendar_detail,
    allow_ai_profile_context = excluded.allow_ai_profile_context,
    allow_ai_uploads = excluded.allow_ai_uploads,
    ai_consent_version = excluded.ai_consent_version,
    ai_consent_updated_at = excluded.ai_consent_updated_at,
    ai_consent_expires_at = excluded.ai_consent_expires_at;

  history_event := case
    when previous_choices is null then 'decision_recorded'
    when exists (
      select 1 from jsonb_each(previous_choices) old_choice
      where old_choice.value = 'true'::jsonb
        and coalesce(next_choices -> old_choice.key, 'false'::jsonb) = 'false'::jsonb
    ) then 'category_revoked'
    else 'decision_updated'
  end;

  insert into public.ai_consent_history (
    user_id, consent_version, consent_epoch, event_type, choices,
    application_version, platform
  ) values (
    current_user_id, p_consent_version, next_epoch, history_event, next_choices,
    p_application_version, p_platform
  );

  delete from public.ai_processing_permits where user_id = current_user_id;
  -- Legacy cache entries have no owner. Purge rather than risk replaying prompt
  -- context after any user's revocation or category change.
  delete from public.ai_generation_cache where cache_key is not null;
  return next_epoch;
end;
$$;

revoke all on function public.set_current_user_ai_consent(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  text, text, text
) from public, anon;
grant execute on function public.set_current_user_ai_consent(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  text, text, text
) to authenticated;

create or replace function public.issue_ai_processing_permit(
  p_user_id uuid,
  p_purpose text,
  p_categories text[],
  p_nonce_hash text
)
returns table (permit_id uuid, consent_epoch bigint, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.user_preferences%rowtype;
  eligibility public.account_eligibility%rowtype;
  category text;
  permitted boolean;
  use_limit integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_purpose not in (
    'morning_briefing', 'daily_plan', 'health_analysis', 'health_checkin',
    'workout_plan', 'fitness_plan', 'meal_plan', 'food_image', 'receipt_image'
  ) or p_nonce_hash !~ '^[a-f0-9]{64}$'
    or cardinality(p_categories) not between 1 and 8
    or not ('basic' = any(p_categories))
    or (select count(*) from unnest(p_categories) as category_rows(category)) <>
       (select count(distinct category) from unnest(p_categories) as category_rows(category))
  then
    raise exception using errcode = '22023', message = 'invalid AI permit request';
  end if;

  select * into prefs from public.user_preferences where user_id = p_user_id;
  select * into eligibility from public.account_eligibility where user_id = p_user_id;
  if prefs.user_id is null
    or eligibility.status <> 'eligible'
    or not eligibility.adult_attested
    or prefs.ai_consent_version <> '2026-07-28'
    or prefs.ai_consent_expires_at is null
    or prefs.ai_consent_expires_at <= now()
    or not prefs.allow_ai_basic_processing
  then
    raise exception using errcode = '42501', message = 'current AI consent required';
  end if;

  foreach category in array p_categories loop
    permitted := case category
      when 'basic' then prefs.allow_ai_basic_processing
      when 'tasks' then prefs.allow_ai_tasks_context
      when 'checkin' then prefs.allow_ai_checkin_context
      when 'health' then prefs.allow_ai_health_context
      when 'calendar_availability' then prefs.allow_ai_calendar_availability
      when 'calendar_detail' then prefs.allow_ai_calendar_detail and prefs.allow_ai_calendar_availability
      when 'profile' then prefs.allow_ai_profile_context
      when 'uploads' then prefs.allow_ai_uploads
      else false
    end;
    if not permitted then
      raise exception using errcode = '42501', message = 'AI category not permitted';
    end if;
  end loop;

  use_limit := case when p_purpose = 'daily_plan' then 8 else 2 end;
  return query
  insert into public.ai_processing_permits (
    user_id, purpose, allowed_categories, consent_version, consent_epoch,
    nonce_hash, max_uses, expires_at
  ) values (
    p_user_id, p_purpose, p_categories, '2026-07-28', eligibility.consent_epoch,
    p_nonce_hash, use_limit, now() + interval '2 minutes'
  ) returning ai_processing_permits.id, ai_processing_permits.consent_epoch,
              ai_processing_permits.expires_at, ai_processing_permits.max_uses;
end;
$$;

revoke all on function public.issue_ai_processing_permit(uuid, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.issue_ai_processing_permit(uuid, text, text[], text)
  to service_role;

create or replace function public.consume_ai_processing_permit(
  p_permit_id uuid,
  p_user_id uuid,
  p_purpose text,
  p_categories text[],
  p_nonce_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  update public.ai_processing_permits permit
  set use_count = permit.use_count + 1,
      last_used_at = now()
  from public.account_eligibility eligibility, public.user_preferences prefs
  where permit.id = p_permit_id
    and permit.user_id = p_user_id
    and permit.purpose = p_purpose
    and permit.allowed_categories = p_categories
    and permit.nonce_hash = p_nonce_hash
    and permit.expires_at > now()
    and permit.use_count < permit.max_uses
    and eligibility.user_id = permit.user_id
    and eligibility.status = 'eligible'
    and eligibility.adult_attested
    and eligibility.consent_epoch = permit.consent_epoch
    and prefs.user_id = permit.user_id
    and prefs.ai_consent_version = permit.consent_version
    and prefs.ai_consent_expires_at > now();
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.consume_ai_processing_permit(uuid, uuid, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.consume_ai_processing_permit(uuid, uuid, text, text[], text)
  to service_role;

-- Reconcile the minor-response function with the granular consent model. Keep
-- encrypted OAuth credentials until the deletion worker can revoke them at the
-- provider; deleting them here would make remote revocation impossible.
create or replace function public.restrict_current_user_as_minor()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  job_id uuid;
  next_epoch bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  insert into public.account_eligibility (
    user_id, status, adult_attested, restricted_at, restriction_reason, consent_epoch
  ) values (
    current_user_id, 'restricted_minor', false, now(), 'self_identified_under_18', 1
  )
  on conflict (user_id) do update set
    status = 'restricted_minor',
    adult_attested = false,
    adult_attested_at = null,
    adult_attestation_version = null,
    restricted_at = now(),
    restriction_reason = 'self_identified_under_18',
    consent_epoch = public.account_eligibility.consent_epoch + 1
  returning consent_epoch into next_epoch;

  update public.user_preferences set
    allow_ai_basic_processing = false,
    allow_ai_tasks_context = false,
    allow_ai_health_context = false,
    allow_ai_calendar_context = false,
    allow_ai_calendar_availability = false,
    allow_ai_calendar_detail = false,
    allow_ai_checkin_context = false,
    allow_ai_profile_context = false,
    allow_ai_uploads = false,
    ai_consent_version = null,
    ai_consent_updated_at = now(),
    ai_consent_expires_at = null
  where user_id = current_user_id;

  insert into public.ai_consent_history (
    user_id, consent_version, consent_epoch, event_type, choices,
    application_version, platform
  ) values (
    current_user_id, '2026-07-28', next_epoch, 'category_revoked',
    '{"basic":false,"tasks":false,"checkin":false,"health":false,"calendarAvailability":false,"calendarDetail":false,"profile":false,"uploads":false}'::jsonb,
    'web-0.1.0', 'web'
  );

  delete from public.ai_processing_permits where user_id = current_user_id;
  delete from public.ai_generation_cache where cache_key is not null;
  delete from public.calendar_sync_settings where user_id = current_user_id;
  delete from public.push_subscriptions where user_id = current_user_id;
  delete from public.notification_settings where user_id = current_user_id;

  insert into public.account_deletion_jobs (user_id, reason)
  values (current_user_id, 'known_minor')
  on conflict (user_id) where status in ('pending', 'processing', 'retry_wait', 'blocked')
  do update set next_attempt_at = now(), updated_at = now()
  returning id into job_id;

  return job_id;
end;
$$;

revoke all on function public.restrict_current_user_as_minor() from public, anon;
grant execute on function public.restrict_current_user_as_minor() to authenticated;
