-- Structured fitness engine. Exercises are a shared, AI-generated library
-- (readable by all signed-in users, written only by the service role).
-- Per-user workout data is RLS-protected to the owner.

-- ── exercises (shared library / cache) ──────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  primary_muscles jsonb not null default '[]',
  secondary_muscles jsonb not null default '[]',
  equipment jsonb not null default '[]',
  difficulty text not null,
  movement_pattern text,
  instructions jsonb not null default '[]',
  common_mistakes jsonb not null default '[]',
  safety_notes jsonb not null default '[]',
  contraindications jsonb not null default '[]',
  home_friendly boolean not null default true,
  gym_friendly boolean not null default true,
  estimated_duration_minutes int,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
-- Shared catalog: any signed-in user may read; writes go through the service role.
create policy "exercises: read all" on public.exercises for select using (true);
create index exercises_category_idx on public.exercises (category);
create index exercises_difficulty_idx on public.exercises (difficulty);

-- ── user_equipment ──────────────────────────────────────────────────────────
create table public.user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.user_equipment enable row level security;
create policy "user_equipment: read own" on public.user_equipment for select using ((select auth.uid()) = user_id);
create policy "user_equipment: insert own" on public.user_equipment for insert with check ((select auth.uid()) = user_id);
create policy "user_equipment: delete own" on public.user_equipment for delete using ((select auth.uid()) = user_id);

-- ── user_limitations (injuries / constraints) ───────────────────────────────
create table public.user_limitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table public.user_limitations enable row level security;
create policy "user_limitations: read own" on public.user_limitations for select using ((select auth.uid()) = user_id);
create policy "user_limitations: insert own" on public.user_limitations for insert with check ((select auth.uid()) = user_id);
create policy "user_limitations: delete own" on public.user_limitations for delete using ((select auth.uid()) = user_id);

-- ── user_workouts (generated plans + history) ───────────────────────────────
create table public.user_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default ((now() at time zone 'utc')::date),
  title text not null,
  intensity text check (intensity in ('low', 'moderate', 'high')),
  reasoning_summary text,
  estimated_duration_minutes int,
  plan jsonb not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_workouts enable row level security;
create policy "user_workouts: read own" on public.user_workouts for select using ((select auth.uid()) = user_id);
create policy "user_workouts: insert own" on public.user_workouts for insert with check ((select auth.uid()) = user_id);
create policy "user_workouts: update own" on public.user_workouts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_workouts: delete own" on public.user_workouts for delete using ((select auth.uid()) = user_id);
create index user_workouts_user_date_idx on public.user_workouts (user_id, date desc);

-- ── user_workout_logs (what was actually done) ──────────────────────────────
create table public.user_workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid references public.user_workouts (id) on delete set null,
  logged_at timestamptz not null default now(),
  entries jsonb not null default '[]',
  perceived_effort int check (perceived_effort between 1 and 10),
  notes text check (char_length(notes) <= 1000)
);
alter table public.user_workout_logs enable row level security;
create policy "user_workout_logs: read own" on public.user_workout_logs for select using ((select auth.uid()) = user_id);
create policy "user_workout_logs: insert own" on public.user_workout_logs for insert with check ((select auth.uid()) = user_id);
create policy "user_workout_logs: delete own" on public.user_workout_logs for delete using ((select auth.uid()) = user_id);
create index user_workout_logs_user_idx on public.user_workout_logs (user_id, logged_at desc);

-- ── ai_generation_cache (service-role only) ─────────────────────────────────
create table public.ai_generation_cache (
  cache_key text primary key,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_generation_cache enable row level security;
-- RLS on, no policies: only the service role (server) touches the cache.

create trigger touch_user_workouts before update on public.user_workouts
  for each row execute function public.touch_updated_at();
