-- Personal trainer: one current AI-generated fitness plan per user (workout
-- program + nutrition targets/guidance). RLS: own row only.

create table public.fitness_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null default '',
  calorie_target int check (calorie_target >= 0),
  protein_g int check (protein_g >= 0),
  carbs_g int check (carbs_g >= 0),
  fat_g int check (fat_g >= 0),
  workout jsonb not null default '{}',
  nutrition jsonb not null default '{}',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fitness_plans enable row level security;

create policy "fitness_plans: read own" on public.fitness_plans
  for select using ((select auth.uid()) = user_id);
create policy "fitness_plans: insert own" on public.fitness_plans
  for insert with check ((select auth.uid()) = user_id);
create policy "fitness_plans: update own" on public.fitness_plans
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger touch_fitness_plans before update on public.fitness_plans
  for each row execute function public.touch_updated_at();
