-- Pick-a-goal challenges: invite friends to compete over a window on a chosen
-- metric (steps or active calories). Scores are summed from health_metrics
-- server-side. Invites are created by the host (admin client, after checking
-- friendship); invitees join by updating their own participant row.

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  metric text not null check (metric in ('steps', 'active_calories')),
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table public.competitions enable row level security;
create policy "competitions: read" on public.competitions for select using (
  creator_id = (select auth.uid())
  or exists (
    select 1 from public.competition_participants p
    where p.competition_id = id and p.user_id = (select auth.uid())
  )
);
create policy "competitions: insert" on public.competitions
  for insert with check (creator_id = (select auth.uid()));
create policy "competitions: update" on public.competitions
  for update using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "competitions: delete" on public.competitions
  for delete using (creator_id = (select auth.uid()));

create table public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  created_at timestamptz not null default now(),
  unique (competition_id, user_id)
);
alter table public.competition_participants enable row level security;
-- You can see and update only your own participant row; hosts manage invites via
-- the service role. Competition standings are assembled server-side.
create policy "competition_participants: read own" on public.competition_participants
  for select using (user_id = (select auth.uid()));
create policy "competition_participants: update own" on public.competition_participants
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index competition_participants_comp_idx on public.competition_participants (competition_id);
create index competition_participants_user_idx on public.competition_participants (user_id);
