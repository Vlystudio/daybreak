-- Recipe / meal engine: the user's current groceries and their thumbs
-- up/down feedback on recipes (so we stop suggesting disliked ones and learn
-- their tastes). RLS: own rows only.

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.grocery_items enable row level security;

create policy "grocery_items: read own" on public.grocery_items
  for select using ((select auth.uid()) = user_id);
create policy "grocery_items: insert own" on public.grocery_items
  for insert with check ((select auth.uid()) = user_id);
create policy "grocery_items: delete own" on public.grocery_items
  for delete using ((select auth.uid()) = user_id);

create index grocery_items_user_idx on public.grocery_items (user_id, created_at);

create table public.recipe_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id bigint not null,
  title text not null check (char_length(title) <= 300),
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.recipe_feedback enable row level security;

create policy "recipe_feedback: read own" on public.recipe_feedback
  for select using ((select auth.uid()) = user_id);
create policy "recipe_feedback: insert own" on public.recipe_feedback
  for insert with check ((select auth.uid()) = user_id);
create policy "recipe_feedback: update own" on public.recipe_feedback
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recipe_feedback: delete own" on public.recipe_feedback
  for delete using ((select auth.uid()) = user_id);
