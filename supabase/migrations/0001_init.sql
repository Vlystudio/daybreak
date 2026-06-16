-- Daybreak initial schema.
-- Every user-facing table has Row Level Security enabled. Tables holding
-- secrets (oauth_connections) or infrastructure state (rate_limits,
-- audit_logs) have RLS enabled with NO policies: only the service role
-- (server-side) can touch them.

create extension if not exists "pgcrypto";

-- ── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  city text check (char_length(city) <= 120),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  avatar_url text check (char_length(avatar_url) <= 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── households ─────────────────────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Helper to avoid recursive RLS lookups.
create or replace function public.is_household_member(h_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = h_id and user_id = (select auth.uid())
  );
$$;

create policy "households: members read" on public.households
  for select using (public.is_household_member(id));
create policy "households: owner update" on public.households
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "households: owner delete" on public.households
  for delete using ((select auth.uid()) = owner_id);

create policy "household_members: members read" on public.household_members
  for select using (public.is_household_member(household_id));
create policy "household_members: leave" on public.household_members
  for delete using ((select auth.uid()) = user_id);

-- Creation/joining go through server actions (service role) so invite codes
-- can be validated and rate-limited server-side.

-- ── oauth_connections (service-role only) ──────────────────────────────────
create table public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('oura', 'google')),
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scope text,
  provider_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- RLS on, zero policies: tokens are unreachable with the anon key, even
-- by their owner. All access goes through the server with the service role.
alter table public.oauth_connections enable row level security;

-- Non-sensitive connection status for the client: a security-definer
-- function that exposes only provider + connected date for the caller,
-- never token columns.
create or replace function public.my_connections()
returns table (provider text, connected_at timestamptz)
language sql
security definer set search_path = public
stable
as $$
  select provider, created_at
  from public.oauth_connections
  where user_id = (select auth.uid());
$$;

-- ── health_metrics ─────────────────────────────────────────────────────────
create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  readiness_score smallint check (readiness_score between 0 and 100),
  sleep_score smallint check (sleep_score between 0 and 100),
  hrv_avg real check (hrv_avg >= 0),
  resting_hr real check (resting_hr >= 0),
  sleep_duration_min integer check (sleep_duration_min >= 0),
  sleep_efficiency smallint check (sleep_efficiency between 0 and 100),
  deep_sleep_min integer check (deep_sleep_min >= 0),
  rem_sleep_min integer check (rem_sleep_min >= 0),
  light_sleep_min integer check (light_sleep_min >= 0),
  activity_balance real,
  body_temperature_delta real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.health_metrics enable row level security;

-- Read own data only; writes happen server-side via Oura sync (service role).
create policy "health_metrics: read own" on public.health_metrics
  for select using ((select auth.uid()) = user_id);

create index health_metrics_user_date_idx on public.health_metrics (user_id, date desc);

-- ── daily_summaries (AI morning briefings) ─────────────────────────────────
create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  summary text not null,
  focus text,
  insights jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_summaries enable row level security;

create policy "daily_summaries: read own" on public.daily_summaries
  for select using ((select auth.uid()) = user_id);

-- ── schedule_events ────────────────────────────────────────────────────────
create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  location text check (char_length(location) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'google')),
  google_event_id text,
  color text check (color in ('honey', 'sage', 'sky', 'peach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (user_id, google_event_id)
);

alter table public.schedule_events enable row level security;

create policy "schedule_events: read own or household" on public.schedule_events
  for select using (
    (select auth.uid()) = user_id
    or (household_id is not null and public.is_household_member(household_id))
  );
create policy "schedule_events: insert own" on public.schedule_events
  for insert with check (
    (select auth.uid()) = user_id
    and (household_id is null or public.is_household_member(household_id))
  );
create policy "schedule_events: update own" on public.schedule_events
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (household_id is null or public.is_household_member(household_id))
  );
create policy "schedule_events: delete own" on public.schedule_events
  for delete using ((select auth.uid()) = user_id);

create index schedule_events_user_time_idx on public.schedule_events (user_id, starts_at);
create index schedule_events_household_time_idx
  on public.schedule_events (household_id, starts_at) where household_id is not null;

-- ── calendar_sync_settings ─────────────────────────────────────────────────
create table public.calendar_sync_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sync_enabled boolean not null default true,
  google_calendar_id text not null default 'primary' check (char_length(google_calendar_id) <= 256),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.calendar_sync_settings enable row level security;

create policy "calendar_sync: read own" on public.calendar_sync_settings
  for select using ((select auth.uid()) = user_id);
create policy "calendar_sync: upsert own" on public.calendar_sync_settings
  for insert with check ((select auth.uid()) = user_id);
create policy "calendar_sync: update own" on public.calendar_sync_settings
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── audit_logs (service-role writes; users may read their own) ─────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs: read own" on public.audit_logs
  for select using ((select auth.uid()) = user_id);

create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

-- ── rate_limits (service-role only) ────────────────────────────────────────
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

create or replace function public.increment_rate_limit(p_key text, p_window_start timestamptz)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = rl.count + 1
  returning count into new_count;

  -- Opportunistic cleanup of stale windows.
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return new_count;
end;
$$;

-- Only the service role may call this.
revoke execute on function public.increment_rate_limit(text, timestamptz) from public, anon, authenticated;

-- ── updated_at maintenance ─────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_oauth_connections before update on public.oauth_connections
  for each row execute function public.touch_updated_at();
create trigger touch_health_metrics before update on public.health_metrics
  for each row execute function public.touch_updated_at();
create trigger touch_schedule_events before update on public.schedule_events
  for each row execute function public.touch_updated_at();
create trigger touch_calendar_sync before update on public.calendar_sync_settings
  for each row execute function public.touch_updated_at();
