-- Conversational health check-ins: a short back-and-forth where the assistant
-- asks a pointed question about your recent Oura trends, you answer, and it
-- analyzes with that context. One row per conversation; messages is an ordered
-- array of { role: 'assistant' | 'user', content, at }.

create table public.health_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.health_checkins enable row level security;
create policy "health_checkins: own" on public.health_checkins
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index health_checkins_user_idx on public.health_checkins (user_id, updated_at desc);
create trigger touch_health_checkins before update on public.health_checkins
  for each row execute function public.touch_updated_at();
