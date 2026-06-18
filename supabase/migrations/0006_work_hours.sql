-- Structured work hours so the planner can block the user's shift itself,
-- independent of any Google Calendar events.

alter table public.user_preferences
  add column if not exists work_start_time text
    check (work_start_time ~ '^([01]\d|2[0-3]):[0-5]\d$');
alter table public.user_preferences
  add column if not exists work_end_time text
    check (work_end_time ~ '^([01]\d|2[0-3]):[0-5]\d$');
alter table public.user_preferences
  add column if not exists work_days jsonb not null default '[]';
