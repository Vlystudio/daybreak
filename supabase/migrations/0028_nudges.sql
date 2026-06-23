-- Accountability nudges: a friend sends a quick cheer or reminder. Sending is
-- gated to accepted friends server-side (admin client), and delivery rides the
-- push channel. Recipients read and mark their own nudges read.

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'cheer' check (kind in ('cheer', 'reminder')),
  message text check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_user_id <> to_user_id)
);

alter table public.nudges enable row level security;

-- Recipients read their own nudges and can mark them read. Inserts go through a
-- server action (service role) after the friendship is verified.
create policy "nudges: read own" on public.nudges
  for select using ((select auth.uid()) = to_user_id);
create policy "nudges: update own" on public.nudges
  for update using ((select auth.uid()) = to_user_id) with check ((select auth.uid()) = to_user_id);

create index nudges_to_user_idx on public.nudges (to_user_id, created_at desc) where read_at is null;
