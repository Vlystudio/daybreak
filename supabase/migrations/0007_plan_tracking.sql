-- Track the local date today's plan was last (re)built, so the hourly job
-- refreshes today's plan exactly once — after that day's Oura recovery is in.

alter table public.user_preferences
  add column if not exists last_planned_date date;
