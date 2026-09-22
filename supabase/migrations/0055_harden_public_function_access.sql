-- Narrow callable RPC surfaces; triggers continue to run through PostgreSQL.
-- This migration preserves authenticated policy helpers and connection lookup.
alter function public.touch_updated_at() set search_path = pg_catalog;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.my_connections() from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.my_connections() to authenticated;
