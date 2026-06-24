-- Shop & feeding. Seeds buy food; feeding a bird raises its happiness and gives
-- it XP. Each species can only eat foods that match its real diet — enforced in
-- app code (src/lib/game/shop.ts) on top of these tables. Inventory and all
-- balance writes go through the service role; tables are read-own only.

alter table public.user_birds
  add column if not exists happiness integer not null default 60 check (happiness between 0 and 100),
  add column if not exists last_fed_at timestamptz;

create table if not exists public.user_inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  qty integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.user_inventory enable row level security;
create policy "user_inventory: read own" on public.user_inventory
  for select using ((select auth.uid()) = user_id);
