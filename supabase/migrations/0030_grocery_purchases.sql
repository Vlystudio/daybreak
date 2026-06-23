-- Grocery purchases (from a scanned receipt or manual entry), so Daybreak can
-- track real spend against grocery_settings.weekly_budget — closing the loop
-- from plan → buy → spent. Line items are kept as jsonb for reference; the total
-- and date are what budget tracking needs.

create table public.grocery_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  store text check (char_length(store) <= 120),
  purchased_on date not null,
  total numeric not null check (total >= 0),
  item_count integer check (item_count >= 0),
  items jsonb not null default '[]',
  source text not null default 'receipt' check (source in ('receipt', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.grocery_purchases enable row level security;

create policy "grocery_purchases: read own or household" on public.grocery_purchases
  for select using (
    (select auth.uid()) = user_id
    or (household_id is not null and public.is_household_member(household_id))
  );
create policy "grocery_purchases: insert own" on public.grocery_purchases
  for insert with check ((select auth.uid()) = user_id);
create policy "grocery_purchases: delete own" on public.grocery_purchases
  for delete using ((select auth.uid()) = user_id);

create index grocery_purchases_user_date_idx on public.grocery_purchases (user_id, purchased_on desc);
create index grocery_purchases_household_idx on public.grocery_purchases (household_id, purchased_on desc)
  where household_id is not null;
