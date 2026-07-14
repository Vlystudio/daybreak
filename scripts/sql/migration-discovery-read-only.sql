\set ON_ERROR_STOP on

-- Production migration discovery. This file must remain SELECT-only and is
-- statically checked by scripts/discover-migration-state.mjs before execution.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT 'transaction_mode' AS section, current_setting('transaction_read_only') AS value;

SELECT 'migration_history_columns' AS section, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

SELECT 'migration_history_0020_0022' AS section, to_jsonb(m) AS history_row
FROM supabase_migrations.schema_migrations AS m
WHERE to_jsonb(m)->>'version' IN ('0020', '0021', '0022')
ORDER BY to_jsonb(m)->>'version';

SELECT 'duplicate_0021_columns' AS section,
       table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE (table_schema, table_name, column_name) IN (
  ('public', 'daily_summaries', 'input_hash'),
  ('public', 'fitness_plans', 'input_hash')
)
ORDER BY table_name;

SELECT 'subjective_checkins_table' AS section,
       to_regclass('public.subjective_checkins') AS relation,
       c.relrowsecurity,
       c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'subjective_checkins';

SELECT 'subjective_checkins_columns' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subjective_checkins'
ORDER BY ordinal_position;

SELECT 'subjective_checkins_constraints' AS section,
       con.conname,
       con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS rel ON rel.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public' AND rel.relname = 'subjective_checkins'
ORDER BY con.conname;

SELECT 'subjective_checkins_policies' AS section,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
ORDER BY policyname;

SELECT 'subjective_checkins_indexes' AS section, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'subjective_checkins'
ORDER BY indexname;

SELECT 'subjective_checkins_triggers' AS section,
       tg.tgname,
       pg_get_triggerdef(tg.oid) AS definition
FROM pg_trigger AS tg
JOIN pg_class AS c ON c.oid = tg.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'subjective_checkins'
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;

WITH target_relations AS MATERIALIZED (
  SELECT oid
  FROM (VALUES
    (to_regclass('public.daily_summaries')),
    (to_regclass('public.fitness_plans')),
    (to_regclass('public.subjective_checkins'))
  ) AS relations(oid)
  WHERE oid IS NOT NULL
),
target_dependencies AS MATERIALIZED (
  SELECT pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent_object,
         pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) AS referenced_object,
         d.deptype
  FROM pg_depend AS d
  WHERE d.refobjid IN (SELECT oid FROM target_relations)
)
SELECT 'database_dependencies' AS section,
       dependent_object,
       referenced_object,
       deptype
FROM target_dependencies
WHERE referenced_object ~ '(input_hash|subjective_checkins)'
ORDER BY referenced_object, dependent_object;

SELECT 'view_dependencies' AS section, schemaname, viewname
FROM pg_views
WHERE definition ~* '(subjective_checkins|input_hash)'
ORDER BY schemaname, viewname;

SELECT 'trigger_dependencies' AS section,
       n.nspname AS schema_name,
       c.relname AS table_name,
       tg.tgname,
       pg_get_triggerdef(tg.oid) AS definition
FROM pg_trigger AS tg
JOIN pg_class AS c ON c.oid = tg.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE NOT tg.tgisinternal
  AND pg_get_triggerdef(tg.oid) ~* '(subjective_checkins|input_hash)'
ORDER BY n.nspname, c.relname, tg.tgname;

COMMIT;
