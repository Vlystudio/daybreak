-- Goals with a trajectory: a concrete target (weight or body-fat) by a date,
-- tracked against what the user logs in body_measurements. Values are stored in
-- the metric's canonical unit (weight in kg, body fat in %); the UI converts for
-- display. One active goal per metric is the expected shape, but not enforced.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (metric in ('weight', 'body_fat')),
  start_value real not null,
  target_value real not null,
  start_date date not null,
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals: read own" on public.goals
  for select using ((select auth.uid()) = user_id);
create policy "goals: insert own" on public.goals
  for insert with check ((select auth.uid()) = user_id);
create policy "goals: update own" on public.goals
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals: delete own" on public.goals
  for delete using ((select auth.uid()) = user_id);

create index goals_user_idx on public.goals (user_id) where status = 'active';

create trigger touch_goals before update on public.goals
  for each row execute function public.touch_updated_at();
