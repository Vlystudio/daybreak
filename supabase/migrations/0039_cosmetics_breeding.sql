-- Cosmetics + breeding. Birds can wear one accessory; the nest can be decorated
-- with bought decor; and two birds can be paired to lay an egg that hatches
-- (luck decides the chick) after an incubation timer. Accessories/decor are
-- bought through user_inventory / user_game like other items; writes go through
-- the service role. Tables are read-own only.

alter table public.user_birds add column if not exists accessory text;
alter table public.user_game add column if not exists decor text[] not null default '{}';

create table if not exists public.user_eggs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_a uuid references public.user_birds (id) on delete set null,
  parent_b uuid references public.user_birds (id) on delete set null,
  species_key text not null,
  rarity text not null default 'common',
  hatch_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.user_eggs enable row level security;
create policy "user_eggs: read own" on public.user_eggs
  for select using ((select auth.uid()) = user_id);
create index user_eggs_user_idx on public.user_eggs (user_id, created_at desc);
