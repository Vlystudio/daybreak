-- Self-care game layer. Completing the day's tasks (habits like brushing teeth,
-- planned events, check-ins, nutrition, reviews) earns "seeds" (the currency),
-- which hatch and grow a collection of birds. All economy writes go through the
-- service role from server actions/engine — these tables have read-own RLS and
-- no client write policies, so balances can't be forged.

create table public.user_birds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  species_key text not null,
  nickname text check (char_length(nickname) <= 40),
  xp integer not null default 0 check (xp >= 0),
  hatched_at timestamptz not null default now()
);
alter table public.user_birds enable row level security;
create policy "user_birds: read own" on public.user_birds
  for select using ((select auth.uid()) = user_id);
create index user_birds_user_idx on public.user_birds (user_id, hatched_at desc);

create table public.user_game (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seeds integer not null default 0 check (seeds >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  active_bird_id uuid references public.user_birds (id) on delete set null,
  last_login_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_game enable row level security;
create policy "user_game: read own" on public.user_game
  for select using ((select auth.uid()) = user_id);
create trigger touch_user_game before update on public.user_game
  for each row execute function public.touch_updated_at();

-- One row per earned reward; the unique key makes granting idempotent so a task
-- is never paid out twice (re-syncing the day is safe).
create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  source text not null,
  amount integer not null check (amount >= 0),
  awarded_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.reward_ledger enable row level security;
create policy "reward_ledger: read own" on public.reward_ledger
  for select using ((select auth.uid()) = user_id);
create index reward_ledger_user_date_idx on public.reward_ledger (user_id, awarded_on desc);
