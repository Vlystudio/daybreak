-- Security hardening: health_observations is a SERVER-OWNED provenance store.
--
-- Every legitimate write goes through the service-role admin client (wearable
-- sync, Apple Health ingest, manual check-in server actions that force
-- source = 'manual', and the admin backfill) — all of which bypass RLS.
--
-- The original 0042 policies ALSO granted an authenticated user INSERT/UPDATE/
-- DELETE on their own rows via the Supabase client. Because each row carries a
-- `source` and metric value, that let a user FORGE provider-attributed data
-- (e.g. source = 'oura' / 'apple_health') and thereby skew the confidence /
-- fusion / Daily-Plan layer with values no wearable actually produced.
--
-- Drop the client write policies so the client can only SELECT its own
-- observations; all writes remain exclusively server-controlled. No app flow
-- depends on client writes, so this is behavior-preserving.

drop policy if exists "health_observations: insert own" on public.health_observations;
drop policy if exists "health_observations: update own" on public.health_observations;
drop policy if exists "health_observations: delete own" on public.health_observations;

-- "health_observations: read own" (SELECT) is intentionally retained so a user
-- can still read their own provenance rows. RLS stays enabled, so with no write
-- policy present the client cannot insert/update/delete at all.
