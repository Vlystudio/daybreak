-- Pull in the rest of Oura's daily data: activity (steps/calories/score),
-- blood oxygen, respiratory rate, daily stress, and resilience. All optional
-- (older rings / accounts may not provide every field).

alter table public.health_metrics
  add column if not exists steps integer check (steps >= 0),
  add column if not exists active_calories integer check (active_calories >= 0),
  add column if not exists total_calories integer check (total_calories >= 0),
  add column if not exists activity_score smallint check (activity_score between 0 and 100),
  add column if not exists spo2_avg real check (spo2_avg >= 0 and spo2_avg <= 100),
  add column if not exists respiratory_rate real check (respiratory_rate >= 0),
  add column if not exists stress_high_min integer check (stress_high_min >= 0),
  add column if not exists recovery_high_min integer check (recovery_high_min >= 0),
  add column if not exists resilience_level text;
