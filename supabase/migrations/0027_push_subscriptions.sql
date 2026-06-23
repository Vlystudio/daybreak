-- Web Push subscriptions. One row per browser/device endpoint. The morning job
-- sends the briefing to each of a user's subscriptions; dead endpoints (410/404)
-- are pruned server-side. Keys are needed to encrypt the push payload.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
