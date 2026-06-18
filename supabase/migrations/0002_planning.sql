-- Daybreak planning: user preferences captured during onboarding. Feeds the
-- AI smart planner, personal trainer, and recipe engine. RLS: own rows only.

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Work
  work_type text check (work_type in ('office', 'physical', 'mixed', 'student', 'unemployed', 'other')),
  work_title text check (char_length(work_title) <= 120),
  work_schedule text check (char_length(work_schedule) <= 200),

  -- Fitness goal & current activity
  fitness_goal text check (fitness_goal in ('weight_loss', 'muscle_gain', 'endurance', 'general_fitness', 'maintain')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  exercise_frequency text check (exercise_frequency in ('none', '1-2', '3-4', '5-6', 'daily')),

  -- Body metrics (used by the personal trainer; optional)
  height_in numeric check (height_in > 0 and height_in <= 108),
  weight_lb numeric check (weight_lb > 0 and weight_lb <= 1500),
  sex text check (sex in ('male', 'female', 'other', 'prefer_not')),
  birth_year int check (birth_year between 1900 and 2025),

  -- Lifestyle
  hobbies jsonb not null default '[]',
  social_tendency text check (social_tendency in ('homebody', 'balanced', 'social')),

  -- Chores: array of { name, frequency }
  chores jsonb not null default '[]',

  -- Diet
  dietary_restrictions jsonb not null default '[]',
  dietary_notes text check (char_length(dietary_notes) <= 500),

  -- Planning preference
  planning_scope text check (planning_scope in ('after_hours', 'few_days', 'full_week', 'weekends')),

  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "user_preferences: read own" on public.user_preferences
  for select using ((select auth.uid()) = user_id);
create policy "user_preferences: insert own" on public.user_preferences
  for insert with check ((select auth.uid()) = user_id);
create policy "user_preferences: update own" on public.user_preferences
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger touch_user_preferences before update on public.user_preferences
  for each row execute function public.touch_updated_at();
