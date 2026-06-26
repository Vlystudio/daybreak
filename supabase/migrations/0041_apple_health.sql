-- Apple Health import.
--
-- Apple Health / HealthKit has no server API: data only leaves the iPhone via a
-- manual "Export All Health Data" zip (parsed in the browser, Phase 1) or a
-- native HealthKit app that POSTs batches (Phase 2). Both feed the same tables
-- below, plus the existing health_metrics one-row-per-day model.
--
-- Three tiers:
--   1. health_metrics  — extended with the common daily vitals that fit its grain
--   2. health_workouts — one row per HKWorkout (kept apart from user_workouts,
--                        which are Daybreak's *planned* AI workouts)
--   3. health_daily_samples — the long tail: any HealthKit quantity type, stored
--                        as a per-day aggregate so a multi-year export stays bounded
-- apple_health_imports records each import for status + audit (and doubles as the
-- "Apple Health connected" signal, since there are no OAuth tokens to store).

-- ── 1. Extend health_metrics with body vitals + activity-ring fields ─────────
alter table public.health_metrics
  add column if not exists weight_kg real check (weight_kg >= 0),
  add column if not exists body_fat_pct real check (body_fat_pct >= 0 and body_fat_pct <= 100),
  add column if not exists vo2max real check (vo2max >= 0),
  add column if not exists exercise_minutes integer check (exercise_minutes >= 0),
  add column if not exists stand_hours smallint check (stand_hours >= 0 and stand_hours <= 24),
  add column if not exists distance_m real check (distance_m >= 0);

-- ── 2. health_workouts ──────────────────────────────────────────────────────
create table if not exists public.health_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'apple',
  -- Apple's XML export has no stable UUID per workout, so the client derives a
  -- deterministic key from activity type + start + duration for idempotent re-import.
  external_id text not null,
  activity_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  distance_m real check (distance_m >= 0),
  active_energy_kcal real check (active_energy_kcal >= 0),
  total_energy_kcal real check (total_energy_kcal >= 0),
  avg_hr real check (avg_hr >= 0),
  max_hr real check (max_hr >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.health_workouts enable row level security;

-- Read own only; writes happen server-side via the import action (service role).
create policy "health_workouts: read own" on public.health_workouts
  for select using ((select auth.uid()) = user_id);

create index health_workouts_user_started_idx
  on public.health_workouts (user_id, started_at desc);

-- ── 3. health_daily_samples (flexible long tail) ─────────────────────────────
create table if not exists public.health_daily_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  -- Raw HealthKit type identifier, e.g. HKQuantityTypeIdentifierBloodGlucose.
  type text not null,
  unit text,
  sum double precision,
  avg double precision,
  min double precision,
  max double precision,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date, type)
);

alter table public.health_daily_samples enable row level security;

create policy "health_daily_samples: read own" on public.health_daily_samples
  for select using ((select auth.uid()) = user_id);

create index health_daily_samples_user_date_idx
  on public.health_daily_samples (user_id, date desc);

-- ── 4. apple_health_imports (status + audit, doubles as connection signal) ───
create table if not exists public.apple_health_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'file' check (source in ('file', 'healthkit')),
  file_name text,
  range_start date,
  range_end date,
  metrics_days integer not null default 0,
  workouts integer not null default 0,
  samples integer not null default 0,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.apple_health_imports enable row level security;

create policy "apple_health_imports: read own" on public.apple_health_imports
  for select using ((select auth.uid()) = user_id);

create index apple_health_imports_user_created_idx
  on public.apple_health_imports (user_id, created_at desc);
