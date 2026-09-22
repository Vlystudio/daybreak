-- Canonical fresh-install replacement for the two historical migrations that
-- accidentally shared version 0021. Production may already record either old
-- body under version 0021, so this file is for deterministic zero-to-head
-- initialization only. Migration 0048 performs the forward-only reconciliation
-- for every previously deployed state. Exact historical source bodies remain in
-- supabase/legacy-migrations/ for checksum/provenance review.

alter table public.daily_summaries add column if not exists input_hash text;
alter table public.fitness_plans add column if not exists input_hash text;

create table public.subjective_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.subjective_checkins enable row level security;

create policy "subjective_checkins: read own" on public.subjective_checkins
  for select using ((select auth.uid()) = user_id);
create policy "subjective_checkins: insert own" on public.subjective_checkins
  for insert with check ((select auth.uid()) = user_id);
create policy "subjective_checkins: update own" on public.subjective_checkins
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index subjective_checkins_user_date_idx on public.subjective_checkins (user_id, date desc);

create trigger touch_subjective_checkins before update on public.subjective_checkins
  for each row execute function public.touch_updated_at();
