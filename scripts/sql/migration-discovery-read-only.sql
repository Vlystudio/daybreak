\set ON_ERROR_STOP on

-- Production migration discovery. Keep this file SELECT-only. The launcher
-- statically checks the transaction and forbidden keywords before execution.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

WITH migration_history AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'version', to_jsonb(m) ->> 'version',
        'name', to_jsonb(m) ->> 'name',
        'checksum', to_jsonb(m) ->> 'checksum'
      )) ORDER BY to_jsonb(m) ->> 'version'
    ),
    '[]'::jsonb
  ) AS rows
  FROM supabase_migrations.schema_migrations AS m
), subjective_relation AS (
  SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'subjective_checkins'
), subjective_columns AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', column_name,
    'type', data_type,
    'nullable', is_nullable
  ) ORDER BY ordinal_position), '[]'::jsonb) AS rows
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'subjective_checkins'
), subjective_constraints AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', con.conname,
    'type', con.contype,
    'definition', pg_get_constraintdef(con.oid)
  ) ORDER BY con.conname), '[]'::jsonb) AS rows
  FROM pg_constraint AS con
  JOIN pg_class AS rel ON rel.oid = con.conrelid
  JOIN pg_namespace AS n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public' AND rel.relname = 'subjective_checkins'
), subjective_policies AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', policyname,
    'permissive', permissive,
    'roles', roles,
    'command', cmd
  ) ORDER BY policyname), '[]'::jsonb) AS rows
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
), subjective_indexes AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', indexname,
    'definition', indexdef
  ) ORDER BY indexname), '[]'::jsonb) AS rows
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
), subjective_triggers AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', tg.tgname,
    'definition', pg_get_triggerdef(tg.oid)
  ) ORDER BY tg.tgname), '[]'::jsonb) AS rows
  FROM pg_trigger AS tg
  JOIN pg_class AS c ON c.oid = tg.tgrelid
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'subjective_checkins'
    AND NOT tg.tgisinternal
), dependent_views AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname,
    'name', viewname
  ) ORDER BY schemaname, viewname), '[]'::jsonb) AS rows
  FROM pg_views
  WHERE definition ~* '(subjective_checkins|input_hash)'
), dependent_triggers AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'table', c.relname,
    'name', tg.tgname
  ) ORDER BY n.nspname, c.relname, tg.tgname), '[]'::jsonb) AS rows
  FROM pg_trigger AS tg
  JOIN pg_class AS c ON c.oid = tg.tgrelid
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE NOT tg.tgisinternal
    AND pg_get_triggerdef(tg.oid) ~* '(subjective_checkins|input_hash)'
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'transactionReadOnly', current_setting('transaction_read_only')::boolean,
  'migrationHistory', migration_history.rows,
  'legacy0021Effects', jsonb_build_object(
    'dailySummariesInputHash', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'daily_summaries' AND column_name = 'input_hash'
    ),
    'fitnessPlansInputHash', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fitness_plans' AND column_name = 'input_hash'
    ),
    'subjectiveCheckins', jsonb_build_object(
      'exists', EXISTS (SELECT 1 FROM subjective_relation),
      'rls', coalesce((SELECT relrowsecurity FROM subjective_relation), false),
      'forceRls', coalesce((SELECT relforcerowsecurity FROM subjective_relation), false),
      'columns', subjective_columns.rows,
      'constraints', subjective_constraints.rows,
      'policies', subjective_policies.rows,
      'indexes', subjective_indexes.rows,
      'triggers', subjective_triggers.rows
    )
  ),
  'dependencies', jsonb_build_object(
    'views', dependent_views.rows,
    'triggers', dependent_triggers.rows
  )
)::text
FROM migration_history, subjective_columns, subjective_constraints,
     subjective_policies, subjective_indexes, subjective_triggers,
     dependent_views, dependent_triggers;

COMMIT;
