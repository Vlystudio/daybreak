-- Contextual reminders delivered by push at a chosen local hour: hydration, a
-- wind-down nudge, a move break, "log your meals", or a quick check-in. The
-- hourly cron fires each enabled reminder once per local day at its hour.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('hydration', 'wind_down', 'move', 'log_food', 'checkin', 'custom')),
  hour smallint not null check (hour between 0 and 23),
  message text check (char_length(message) <= 140),
  enabled boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

create policy "reminders: read own" on public.reminders
  for select using ((select auth.uid()) = user_id);
create policy "reminders: insert own" on public.reminders
  for insert with check ((select auth.uid()) = user_id);
create policy "reminders: update own" on public.reminders
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reminders: delete own" on public.reminders
  for delete using ((select auth.uid()) = user_id);

create index reminders_user_idx on public.reminders (user_id) where enabled;

create trigger touch_reminders before update on public.reminders
  for each row execute function public.touch_updated_at();
