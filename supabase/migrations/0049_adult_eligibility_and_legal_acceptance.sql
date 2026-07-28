-- Adult-only account eligibility and versioned legal acceptance.
-- Existing users are deliberately pending until they attest and accept current
-- documents. New auth.users inserts are rejected transactionally unless the
-- current explicit metadata is present; no profile/account row survives a
-- failed trigger.

create table public.legal_document_versions (
  document_type text not null check (document_type in (
    'terms',
    'privacy',
    'consumer_health_privacy',
    'health_disclaimer',
    'ai_disclosure',
    'acceptable_use',
    'retention'
  )),
  version text not null check (char_length(version) between 1 and 40),
  effective_at timestamptz not null,
  requires_acceptance boolean not null default false,
  material_change boolean not null default false,
  public_path text not null check (public_path like '/%'),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (document_type, version)
);

alter table public.legal_document_versions enable row level security;
create policy "legal document versions: public read" on public.legal_document_versions
  for select using (true);

insert into public.legal_document_versions (
  document_type,
  version,
  effective_at,
  requires_acceptance,
  material_change,
  public_path
)
values
  ('terms', '2026-07-28', '2026-07-28T00:00:00Z', true, true, '/terms'),
  ('privacy', '2026-07-28', '2026-07-28T00:00:00Z', true, true, '/privacy'),
  ('consumer_health_privacy', '2026-07-28', '2026-07-28T00:00:00Z', false, true, '/legal/consumer-health-privacy'),
  ('health_disclaimer', '2026-07-28', '2026-07-28T00:00:00Z', false, true, '/legal/health-disclaimer'),
  ('ai_disclosure', '2026-07-28', '2026-07-28T00:00:00Z', false, true, '/legal/ai'),
  ('acceptable_use', '2026-07-28', '2026-07-28T00:00:00Z', false, true, '/legal/acceptable-use'),
  ('retention', '2026-07-28', '2026-07-28T00:00:00Z', false, true, '/legal/retention')
on conflict (document_type, version) do nothing;

create table public.account_eligibility (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending_adult_attestation' check (status in (
    'pending_adult_attestation',
    'eligible',
    'restricted_minor',
    'suspended',
    'deletion_pending'
  )),
  adult_attested boolean not null default false,
  adult_attested_at timestamptz,
  adult_attestation_version text,
  terms_version text,
  privacy_version text,
  restricted_at timestamptz,
  restriction_reason text check (restriction_reason is null or restriction_reason in (
    'self_identified_under_18',
    'credible_actual_knowledge',
    'security_or_legal_hold'
  )),
  consent_epoch bigint not null default 0 check (consent_epoch >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'eligible'
      and adult_attested
      and adult_attested_at is not null
      and adult_attestation_version is not null
      and terms_version is not null
      and privacy_version is not null)
    or status <> 'eligible'
  )
);

alter table public.account_eligibility enable row level security;
create policy "account eligibility: read own" on public.account_eligibility
  for select using ((select auth.uid()) = user_id);

create trigger touch_account_eligibility before update on public.account_eligibility
  for each row execute function public.touch_updated_at();

create table public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  application_version text not null check (char_length(application_version) between 1 and 80),
  platform text not null check (platform in ('web', 'ios')),
  locale text not null default 'en' check (char_length(locale) between 2 and 20),
  acceptance_method text not null check (acceptance_method in (
    'signup_checkbox',
    'eligibility_migration',
    'material_change_prompt'
  )),
  foreign key (document_type, document_version)
    references public.legal_document_versions (document_type, version),
  unique (user_id, document_type, document_version)
);

alter table public.user_legal_acceptances enable row level security;
create policy "legal acceptances: read own" on public.user_legal_acceptances
  for select using ((select auth.uid()) = user_id);

create index user_legal_acceptances_user_idx
  on public.user_legal_acceptances (user_id, accepted_at desc);

create table public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('user_request', 'known_minor', 'admin_required')),
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'retry_wait', 'blocked', 'completed'
  )),
  current_step text not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error_class text,
  next_attempt_at timestamptz not null default now(),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_jobs enable row level security;
create policy "deletion jobs: read own" on public.account_deletion_jobs
  for select using ((select auth.uid()) = user_id);
create unique index account_deletion_jobs_one_active_user_idx
  on public.account_deletion_jobs (user_id)
  where status in ('pending', 'processing', 'retry_wait', 'blocked');
create index account_deletion_jobs_worker_idx
  on public.account_deletion_jobs (status, next_attempt_at);
create trigger touch_account_deletion_jobs before update on public.account_deletion_jobs
  for each row execute function public.touch_updated_at();

-- Every pre-existing account must make the current adult/legal decision.
insert into public.account_eligibility (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_current_user_eligible()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.account_eligibility
    where user_id = (select auth.uid())
      and status = 'eligible'
      and adult_attested = true
      and adult_attestation_version = '2026-07-28'
      and terms_version = '2026-07-28'
      and privacy_version = '2026-07-28'
  );
$$;

revoke all on function public.is_current_user_eligible() from public, anon;
grant execute on function public.is_current_user_eligible() to authenticated;

-- Restrictive policies compose with every existing permissive ownership policy,
-- so a pending/restricted user cannot bypass the app through PostgREST.
do $$
declare
  table_name text;
  protected_tables text[] := array[
    'profiles', 'households', 'household_members', 'health_metrics',
    'daily_summaries', 'schedule_events', 'calendar_sync_settings', 'audit_logs',
    'user_preferences', 'fitness_plans', 'grocery_items', 'recipe_feedback',
    'user_equipment', 'user_limitations', 'user_workouts', 'user_workout_logs',
    'user_stores', 'products', 'product_prices', 'recipes', 'recipe_ingredients',
    'pantry_items', 'meal_plans', 'meal_plan_days', 'shopping_lists',
    'shopping_list_items', 'grocery_settings', 'nutrition_goals',
    'analytics_events', 'health_checkins', 'friendships', 'friend_settings',
    'competitions', 'competition_participants', 'notification_settings',
    'subjective_checkins', 'food_logs', 'water_logs', 'body_measurements',
    'evening_reviews', 'habits', 'habit_logs', 'goals', 'nudges',
    'push_subscriptions', 'grocery_purchases', 'reminders', 'user_birds',
    'user_game', 'reward_ledger', 'user_inventory', 'user_eggs',
    'health_workouts', 'health_daily_samples', 'apple_health_imports',
    'health_observations'
  ];
begin
  foreach table_name in array protected_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'eligibility policy target %.% does not exist', 'public', table_name;
    end if;
    execute format(
      'create policy "eligible accounts only" on public.%I as restrictive for all to authenticated using (public.is_current_user_eligible()) with check (public.is_current_user_eligible())',
      table_name
    );
  end loop;
end
$$;

create or replace function public.complete_current_user_eligibility(
  p_adult_attested boolean,
  p_adult_attestation_version text,
  p_terms_version text,
  p_privacy_version text,
  p_application_version text,
  p_platform text,
  p_locale text,
  p_acceptance_method text default 'eligibility_migration'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  accepted_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_adult_attested is distinct from true
    or p_adult_attestation_version <> '2026-07-28'
    or p_terms_version <> '2026-07-28'
    or p_privacy_version <> '2026-07-28'
    or p_platform not in ('web', 'ios')
    or p_acceptance_method not in ('eligibility_migration', 'material_change_prompt')
    or char_length(p_application_version) not between 1 and 80
    or char_length(p_locale) not between 2 and 20
  then
    raise exception using errcode = '22023', message = 'current explicit adult and legal acceptance is required';
  end if;

  insert into public.account_eligibility (
    user_id,
    status,
    adult_attested,
    adult_attested_at,
    adult_attestation_version,
    terms_version,
    privacy_version
  ) values (
    current_user_id,
    'eligible',
    true,
    accepted_at,
    p_adult_attestation_version,
    p_terms_version,
    p_privacy_version
  )
  on conflict (user_id) do update set
    status = 'eligible',
    adult_attested = true,
    adult_attested_at = accepted_at,
    adult_attestation_version = excluded.adult_attestation_version,
    terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version,
    restricted_at = null,
    restriction_reason = null;

  insert into public.user_legal_acceptances (
    user_id, document_type, document_version, accepted_at,
    application_version, platform, locale, acceptance_method
  ) values
    (current_user_id, 'terms', p_terms_version, accepted_at,
      p_application_version, p_platform, p_locale, p_acceptance_method),
    (current_user_id, 'privacy', p_privacy_version, accepted_at,
      p_application_version, p_platform, p_locale, p_acceptance_method)
  on conflict (user_id, document_type, document_version) do nothing;

  return true;
end;
$$;

revoke all on function public.complete_current_user_eligibility(
  boolean, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_current_user_eligibility(
  boolean, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.restrict_current_user_as_minor()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  job_id uuid;
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
    consent_epoch = public.account_eligibility.consent_epoch + 1;

  update public.user_preferences set
    allow_ai_health_context = false,
    allow_ai_calendar_context = false,
    allow_ai_checkin_context = false,
    ai_consent_version = null,
    ai_consent_updated_at = now()
  where user_id = current_user_id;

  -- Do not delete encrypted provider credentials here. The restricted state
  -- immediately stops service-role sync, AI, notifications, and user RLS
  -- access; the durable worker must retain the credential until it confirms
  -- remote provider revocation, then performs local cleanup and Auth deletion.

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

-- Replace the original profile-only trigger. Raising here rolls the auth.users
-- insert back, so no account can be created without current explicit metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at timestamptz := now();
begin
  if coalesce(new.raw_user_meta_data ->> 'adult_attested', 'false') <> 'true'
    or coalesce(new.raw_user_meta_data ->> 'adult_attestation_version', '') <> '2026-07-28'
    or coalesce(new.raw_user_meta_data ->> 'accepted_terms_version', '') <> '2026-07-28'
    or coalesce(new.raw_user_meta_data ->> 'acknowledged_privacy_version', '') <> '2026-07-28'
  then
    raise exception using
      errcode = '23514',
      message = 'current explicit adult attestation and legal acceptance are required';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));

  insert into public.account_eligibility (
    user_id, status, adult_attested, adult_attested_at,
    adult_attestation_version, terms_version, privacy_version
  ) values (
    new.id, 'eligible', true, accepted_at,
    '2026-07-28', '2026-07-28', '2026-07-28'
  );

  insert into public.user_legal_acceptances (
    user_id, document_type, document_version, accepted_at,
    application_version, platform, locale, acceptance_method
  ) values
    (new.id, 'terms', '2026-07-28', accepted_at,
      'web-0.1.0', 'web', 'en', 'signup_checkbox'),
    (new.id, 'privacy', '2026-07-28', accepted_at,
      'web-0.1.0', 'web', 'en', 'signup_checkbox');

  return new;
end;
$$;
