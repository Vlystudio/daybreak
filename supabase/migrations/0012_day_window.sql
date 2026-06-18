-- Day window for the planner: goal wake/sleep times the user can set, plus the
-- actual sleep window pulled from the wearable (Oura). The planner prefers the
-- wearable's recent actuals and falls back to the goal times.

-- Goal wake + bedtime (HH:MM, 24h), like work_start_time/work_end_time.
alter table public.user_preferences
  add column if not exists wake_time text
    check (wake_time ~ '^([01]\d|2[0-3]):[0-5]\d$');
alter table public.user_preferences
  add column if not exists sleep_time text
    check (sleep_time ~ '^([01]\d|2[0-3]):[0-5]\d$');

-- Actual sleep window per day from Oura's long-sleep period.
-- bedtime_start = when they fell asleep; bedtime_end = when they woke up.
alter table public.health_metrics
  add column if not exists bedtime_start timestamptz;
alter table public.health_metrics
  add column if not exists bedtime_end timestamptz;
