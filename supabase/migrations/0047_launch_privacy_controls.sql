-- App Store V1 privacy controls. Explicit AI consent is deny-by-default and
-- versioned so Daybreak can prove which disclosure the user accepted.
-- Existing rows are deliberately reset to denied: the prior 0046 migration
-- defaulted these fields to true without prior opt-in.

alter table public.user_preferences
  add column if not exists ai_consent_version text,
  add column if not exists ai_consent_updated_at timestamptz;

alter table public.user_preferences
  alter column allow_ai_health_context set default false,
  alter column allow_ai_calendar_context set default false,
  alter column allow_ai_checkin_context set default false;

update public.user_preferences
set allow_ai_health_context = false,
    allow_ai_calendar_context = false,
    allow_ai_checkin_context = false,
    ai_consent_version = null,
    ai_consent_updated_at = null
where ai_consent_version is null;

alter table public.user_preferences
  alter column allow_ai_health_context set not null,
  alter column allow_ai_calendar_context set not null,
  alter column allow_ai_checkin_context set not null;
