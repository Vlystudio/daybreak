-- Notification preferences + delivery bookkeeping.
-- One row per user. The morning cron reads `morning_email_enabled` to decide
-- whether to send the daily briefing email, and writes `last_morning_email_sent_at`
-- so a re-run on the same day doesn't double-send. `unsubscribe_token` backs the
-- one-click unsubscribe link in the email footer (no auth required to honor it).

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  morning_email_enabled boolean not null default true,
  last_morning_email_sent_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

-- Users may read and change their own preferences. Inserts/sent-bookkeeping
-- also happen server-side via the service role (which bypasses RLS).
create policy "notification_settings: read own" on public.notification_settings
  for select using ((select auth.uid()) = user_id);
create policy "notification_settings: insert own" on public.notification_settings
  for insert with check ((select auth.uid()) = user_id);
create policy "notification_settings: update own" on public.notification_settings
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger touch_notification_settings before update on public.notification_settings
  for each row execute function public.touch_updated_at();
