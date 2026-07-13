# Supabase migration reconciliation

## Current order and known collision

Local migrations run from `0001_init.sql` through `0047_launch_privacy_controls.sql`. Two historical files share version `0021`:

- `0021_ai_cache.sql`
- `0021_subjective_checkins.sql`

Renaming an applied migration can corrupt Supabase’s migration-history comparison. On July 13, 2026, a read-only `supabase migration list --linked` was attempted with the existing linked project, but remote Postgres authentication required `SUPABASE_DB_PASSWORD`, which is not available in this workspace. No remote migration history was changed and neither historical file was renamed.

## Required owner reconciliation before release

1. From an approved secure environment, export `supabase_migrations.schema_migrations` for project `cybpuscssilbguypptxi` or run `supabase migration list --linked`.
2. Record whether one or both `0021` bodies exist in production (check both the two `input_hash` columns and the `subjective_checkins` table/policies/trigger).
3. Take a database backup.
4. If history records only one `0021`, assign the unrepresented body a new forward timestamp and keep its SQL idempotent. If both bodies exist but history can record only one, add a new idempotent reconciliation migration for the untracked body, then use `supabase migration repair` only with an approved history plan.
5. Do not modify an already-recorded migration checksum/version. Test the chosen plan on a production clone.
6. Run `supabase db reset` from zero and `supabase test db`; then run the same migration set against staging with production-like history.

Until this is completed, database initialization and migration-history safety are a release blocker even if web and iOS code checks pass.
