-- AI data-use consent. Daybreak sends a source-aware health summary, the manual
-- check-in, and (busy) calendar context to an AI processor (OpenAI) to write the
-- morning briefing and daily plan. These per-user toggles let people opt out of
-- each context. They default to TRUE to preserve current behavior; the new
-- control is the explicit in-app disclosure + opt-out, surfaced in Settings.
--
-- When a context is off, the server omits it from the AI payload entirely (it is
-- never sent and the AI is instructed not to reference absent data). Calendar
-- "off" still sends busy time-blocks for conflict-free scheduling, but with the
-- event titles replaced by a generic label so no event details leave the app.

alter table public.user_preferences
  add column if not exists allow_ai_health_context boolean not null default true,
  add column if not exists allow_ai_calendar_context boolean not null default true,
  add column if not exists allow_ai_checkin_context boolean not null default true;
