-- Skip-if-unchanged cache keys for AI generations.
-- `input_hash` stores a SHA-256 of the exact prompt-input payload used to
-- produce the stored briefing / fitness plan. Before paying OpenAI to
-- regenerate, the app compares a freshly computed hash against this column and
-- reuses the existing row when nothing the model sees has changed. Nullable, so
-- rows generated before this column simply miss the cache once and refill on
-- their next generation.

alter table public.daily_summaries add column if not exists input_hash text;
alter table public.fitness_plans add column if not exists input_hash text;
