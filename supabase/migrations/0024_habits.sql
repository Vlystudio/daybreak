-- Habits: a proper habit loop with per-habit streaks, distinct from plan-event
-- adherence. A habit is a small daily intention; habit_logs records the days it
-- was done (one row per habit per local day).

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  emoji text check (char_length(emoji) <= 8),
  color text not null default 'honey' check (color in ('honey', 'sage', 'sky', 'peach')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;
create policy "habits: read own" on public.habits
  for select using ((select auth.uid()) = user_id);
create policy "habits: insert own" on public.habits
  for insert with check ((select auth.uid()) = user_id);
create policy "habits: update own" on public.habits
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habits: delete own" on public.habits
  for delete using ((select auth.uid()) = user_id);
create index habits_user_idx on public.habits (user_id) where archived_at is null;

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table public.habit_logs enable row level security;
create policy "habit_logs: read own" on public.habit_logs
  for select using ((select auth.uid()) = user_id);
create policy "habit_logs: insert own" on public.habit_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "habit_logs: delete own" on public.habit_logs
  for delete using ((select auth.uid()) = user_id);
create index habit_logs_habit_date_idx on public.habit_logs (habit_id, date desc);

create trigger touch_habits before update on public.habits
  for each row execute function public.touch_updated_at();
