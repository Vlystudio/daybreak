-- Link AI plan blocks to structured workouts. plan_type records the block kind
-- (workout/chore/etc.); workout_id points a "workout" block at a generated
-- session in user_workouts.

alter table public.schedule_events add column if not exists plan_type text;
alter table public.schedule_events
  add column if not exists workout_id uuid references public.user_workouts (id) on delete set null;
