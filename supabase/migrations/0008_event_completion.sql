-- Let users check off schedule events (plan blocks, tasks). Null = not done.
alter table public.schedule_events
  add column if not exists completed_at timestamptz;
