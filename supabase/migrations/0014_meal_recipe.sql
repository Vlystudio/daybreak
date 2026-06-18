-- Attach a recipe (ingredients + instructions) to a planned-meal schedule
-- event, so opening the event on the schedule shows how to cook it — no need
-- to leave the app for the original recipe page.

alter table public.schedule_events
  add column if not exists recipe jsonb;
