-- Durable, source-level health observations.
--
-- Each row is ONE metric value EXACTLY as it came from ONE source (oura,
-- apple_health, apple_watch, fitbit, manual, …). This replaces best-effort
-- attribution from the merged health_metrics table with exact provenance, so
-- cross-source disagreement (HRV, resting HR, sleep duration, steps, calories)
-- can be detected precisely.
--
-- The fusion/understanding layer reads these first and falls back to the legacy
-- tables (health_metrics, health_daily_samples, …) only where observations are
-- missing. Dual-writes from the sync/ingest/check-in paths keep this current;
-- backfill-observations seeds history.

create table if not exists public.health_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  source_device text,
  source_app text,
  source_sample_id text,
  metric text not null,
  value_numeric double precision,
  value_text text,
  unit text,
  start_time timestamptz,
  end_time timestamptz,
  date_local date not null,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Daily-aggregate grain: a source provides at most one value per metric per
  -- local day. Re-syncs upsert onto this key, so repeated syncs never duplicate.
  unique (user_id, source, metric, date_local)
);

alter table public.health_observations enable row level security;

-- Users can manage only their own observations. Service-role writes (sync,
-- ingest, backfill) bypass RLS as usual.
create policy "health_observations: read own" on public.health_observations
  for select using ((select auth.uid()) = user_id);
create policy "health_observations: insert own" on public.health_observations
  for insert with check ((select auth.uid()) = user_id);
create policy "health_observations: update own" on public.health_observations
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "health_observations: delete own" on public.health_observations
  for delete using ((select auth.uid()) = user_id);

create index health_observations_user_date_idx
  on public.health_observations (user_id, date_local desc);
create index health_observations_user_metric_date_idx
  on public.health_observations (user_id, metric, date_local desc);
create index health_observations_user_source_metric_date_idx
  on public.health_observations (user_id, source, metric, date_local desc);

-- Sample-level dedup for any future intraday writes. Postgres treats NULLs as
-- distinct, so daily-aggregate rows (sample id NULL) are unaffected.
create unique index health_observations_sample_id_idx
  on public.health_observations (source_sample_id)
  where source_sample_id is not null;
