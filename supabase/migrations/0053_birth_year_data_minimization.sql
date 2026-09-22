-- Adult eligibility is established by explicit attestation. The optional birth
-- year was unnecessary for that purpose and could create actual knowledge of a
-- minor. Restrict clearly-under-18 historical records, queue deletion, then
-- erase and permanently disable collection of birth year.

create temporary table known_minor_accounts on commit drop as
select user_id
from public.user_preferences
where birth_year is not null
  and birth_year >= extract(year from current_date)::integer - 17;

update public.account_eligibility eligibility
set status = 'restricted_minor',
    adult_attested = false,
    adult_attested_at = null,
    adult_attestation_version = null,
    restricted_at = now(),
    restriction_reason = 'credible_actual_knowledge',
    consent_epoch = eligibility.consent_epoch + 1
where eligibility.user_id in (select user_id from known_minor_accounts);

update public.user_preferences preferences
set allow_ai_basic_processing = false,
    allow_ai_tasks_context = false,
    allow_ai_health_context = false,
    allow_ai_calendar_context = false,
    allow_ai_calendar_availability = false,
    allow_ai_calendar_detail = false,
    allow_ai_checkin_context = false,
    allow_ai_profile_context = false,
    allow_ai_uploads = false,
    ai_consent_version = null,
    ai_consent_updated_at = now(),
    ai_consent_expires_at = null
where preferences.user_id in (select user_id from known_minor_accounts);

delete from public.ai_processing_permits
where user_id in (select user_id from known_minor_accounts);
delete from public.calendar_sync_settings
where user_id in (select user_id from known_minor_accounts);
delete from public.push_subscriptions
where user_id in (select user_id from known_minor_accounts);
delete from public.notification_settings
where user_id in (select user_id from known_minor_accounts);

insert into public.account_deletion_jobs (user_id, reason)
select user_id, 'known_minor' from known_minor_accounts
on conflict (user_id) where status in ('pending', 'processing', 'retry_wait', 'blocked')
do update set
  reason = 'known_minor',
  next_attempt_at = now(),
  updated_at = now();

update public.user_preferences set birth_year = null where birth_year is not null;
alter table public.user_preferences
  add constraint user_preferences_birth_year_not_collected check (birth_year is null);
