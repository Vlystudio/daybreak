-- Intake & body logging: closing the loop from "what to eat" (grocery/meal plan)
-- to "what I actually did". Food logs (optionally from a photo), water, and body
-- measurements. Photos themselves are analyzed transiently and never stored —
-- we keep only the resulting description + macros.

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null check (char_length(description) between 1 and 400),
  calories integer check (calories between 0 and 20000),
  protein_g real check (protein_g >= 0),
  carbs_g real check (carbs_g >= 0),
  fat_g real check (fat_g >= 0),
  source text not null default 'manual' check (source in ('manual', 'photo')),
  created_at timestamptz not null default now()
);

alter table public.food_logs enable row level security;
create policy "food_logs: read own" on public.food_logs
  for select using ((select auth.uid()) = user_id);
create policy "food_logs: insert own" on public.food_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "food_logs: update own" on public.food_logs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "food_logs: delete own" on public.food_logs
  for delete using ((select auth.uid()) = user_id);
create index food_logs_user_date_idx on public.food_logs (user_id, date desc);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;
create policy "water_logs: read own" on public.water_logs
  for select using ((select auth.uid()) = user_id);
create policy "water_logs: insert own" on public.water_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "water_logs: delete own" on public.water_logs
  for delete using ((select auth.uid()) = user_id);
create index water_logs_user_date_idx on public.water_logs (user_id, date desc);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg real check (weight_kg between 0 and 700),
  body_fat_pct real check (body_fat_pct between 0 and 80),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_measurements enable row level security;
create policy "body_measurements: read own" on public.body_measurements
  for select using ((select auth.uid()) = user_id);
create policy "body_measurements: insert own" on public.body_measurements
  for insert with check ((select auth.uid()) = user_id);
create policy "body_measurements: update own" on public.body_measurements
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index body_measurements_user_date_idx on public.body_measurements (user_id, date desc);

create trigger touch_body_measurements before update on public.body_measurements
  for each row execute function public.touch_updated_at();
