-- Evening review: a 20-second end-of-day reflection that bookends the morning
-- briefing. One row per local day. The latest review feeds the next plan
-- generation so tomorrow adapts to how today actually went.

create table public.evening_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  day_rating smallint check (day_rating between 1 and 5),
  went_well text check (char_length(went_well) <= 500),
  to_improve text check (char_length(to_improve) <= 500),
  tomorrow_intention text check (char_length(tomorrow_intention) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.evening_reviews enable row level security;

create policy "evening_reviews: read own" on public.evening_reviews
  for select using ((select auth.uid()) = user_id);
create policy "evening_reviews: insert own" on public.evening_reviews
  for insert with check ((select auth.uid()) = user_id);
create policy "evening_reviews: update own" on public.evening_reviews
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index evening_reviews_user_date_idx on public.evening_reviews (user_id, date desc);

create trigger touch_evening_reviews before update on public.evening_reviews
  for each row execute function public.touch_updated_at();
