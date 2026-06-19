-- Two-way calendar sync: push Daybreak's plan events to a dedicated "Daybreak"
-- calendar in the user's Google account. We store that calendar's id and, on
-- each schedule event, the id of its mirrored Google event (so edits/deletes
-- stay in sync).

alter table public.calendar_sync_settings
  add column if not exists daybreak_calendar_id text;

alter table public.schedule_events
  add column if not exists google_export_id text,
  add column if not exists google_exported_at timestamptz;

create index if not exists schedule_events_export_idx
  on public.schedule_events (user_id) where google_export_id is not null;
