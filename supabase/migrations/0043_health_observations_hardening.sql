-- Follow-up hardening for health_observations (0042 was already applied to prod,
-- so this is an additive, non-destructive migration rather than an edit to 0042).
--
-- 1) Scope the source_sample_id uniqueness to (user_id, source). A raw sample id
--    is only unique within ONE source for ONE user; two different users — or two
--    different sources — could emit the same id, so a global unique index would
--    wrongly collide them. Safe to swap now because no rows write source_sample_id
--    yet (every current row is a daily aggregate with a NULL sample id).
--
-- 2) Add aggregation_type to future-proof the grain. Every row written today is a
--    DAILY aggregate; this records that explicitly and leaves room for finer
--    grains later WITHOUT changing the daily upsert conflict target.
--
-- SCOPE / LIMITATION (intentional): health_observations is a DAILY-observation
-- store. It is NOT a true intraday sample store. Exact Apple Watch heart-rate
-- samples, workout HR streams, sleep sessions, and per-sample HRV will need
-- either a sample-grained unique key keyed on source_sample_id (with
-- aggregation_type = 'sample' | 'workout' | 'sleep_session'), or a dedicated
-- `health_samples` table. Do NOT repurpose the daily conflict target
-- (user_id, source, metric, date_local) for intraday data.

-- 1) Re-scope source_sample_id uniqueness to (user_id, source, source_sample_id).
drop index if exists public.health_observations_sample_id_idx;
create unique index health_observations_sample_id_idx
  on public.health_observations (user_id, source, source_sample_id)
  where source_sample_id is not null;

-- 2) Aggregation grain — defaults to the current daily behavior, so existing rows
--    backfill to 'daily' and the daily conflict target is unchanged.
alter table public.health_observations
  add column if not exists aggregation_type text not null default 'daily';

alter table public.health_observations
  drop constraint if exists health_observations_aggregation_type_check;
alter table public.health_observations
  add constraint health_observations_aggregation_type_check
  check (aggregation_type in ('daily', 'sample', 'workout', 'sleep_session', 'manual_entry'));
