-- Auto-plan cadence: let users have Daybreak regenerate their whole plan
-- automatically on a schedule (off/daily/few_times_week/weekly), instead of
-- pressing Generate. last_autoplan_date gates it to once per local day.

alter table public.user_preferences
  add column if not exists auto_plan_cadence text not null default 'off'
    check (auto_plan_cadence in ('off', 'daily', 'few_times_week', 'weekly'));

alter table public.user_preferences
  add column if not exists last_autoplan_date date;
