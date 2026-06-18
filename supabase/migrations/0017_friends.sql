-- Friends: mutual connections via requests, plus per-category privacy controls
-- for what friends are allowed to see. Cross-user reads of shared data are done
-- server-side (admin client) after checking friendship + the owner's settings,
-- so we don't need permissive cross-user RLS on the health/schedule tables.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
alter table public.friendships enable row level security;
create policy "friendships: read own" on public.friendships for select using (
  (select auth.uid()) = requester_id or (select auth.uid()) = addressee_id
);
create policy "friendships: insert" on public.friendships for insert with check (
  (select auth.uid()) = requester_id
);
create policy "friendships: update" on public.friendships for update using (
  (select auth.uid()) = requester_id or (select auth.uid()) = addressee_id
) with check (
  (select auth.uid()) = requester_id or (select auth.uid()) = addressee_id
);
create policy "friendships: delete" on public.friendships for delete using (
  (select auth.uid()) = requester_id or (select auth.uid()) = addressee_id
);
create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);

-- What this user lets friends see. Default: share nothing.
create table public.friend_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  share_activity boolean not null default false,
  share_calendar boolean not null default false,
  share_goals boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.friend_settings enable row level security;
create policy "friend_settings: own" on public.friend_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger touch_friend_settings before update on public.friend_settings
  for each row execute function public.touch_updated_at();

-- Resolve an email to a user id for friend invites. SECURITY DEFINER so it can
-- read auth.users; locked down so only the service role (server actions) calls it.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
