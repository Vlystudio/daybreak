# Production function permission review

Migration source: `supabase/migrations/0055_harden_public_function_access.sql`.
Applied through the Supabase migration API on September 22, 2026 after isolated
testing. The API reported success; a subsequent read-only privilege query verified:

| Function            | Anonymous execute | Authenticated execute | Search path |
| ------------------- | ----------------- | --------------------- | ----------- |
| handle_new_user     | No                | No                    | public      |
| is_household_member | No                | Yes                   | public      |
| my_connections      | No                | Yes                   | public      |
| touch_updated_at    | Yes               | Yes                   | pg_catalog  |

The signup trigger still runs through PostgreSQL. Authenticated policy helpers
retain their intended caller-scoped access. The timestamp function is an invoker
trigger, with no elevated privileges or callable trigger context through RPC.

Local evidence: eight upgrade scenarios, two complete resets and 112 pgTAP
assertions per pass, including the new seven function-privilege assertions. The
first attempt completed its SQL assertions but the CLI failed during PostHog
shutdown. A complete rerun using documented `SUPABASE_TELEMETRY_DISABLED=1`
succeeded; the test harness now sets this for subprocesses.

The production security advisor no longer reports anonymous SECURITY DEFINER
execution or mutable function search paths. Its remaining seven authenticated
SECURITY DEFINER warnings correspond to intentionally caller-scoped RPCs covered
by the runtime security suites. Six no-policy tables are intentionally server-only.
Leaked-password protection is unavailable on the current Free plan and remains a
recorded limitation; this change does not claim that feature is enabled.

The migration changes no user records and grants no new access to user data.
