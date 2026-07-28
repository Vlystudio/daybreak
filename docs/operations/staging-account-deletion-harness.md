# Staging account-deletion harness

This harness creates only randomized `@example.invalid` identities and refuses
the known production Supabase and application hosts. It exercises authentication,
reauthentication, the durable queue, the deployed cron worker, receipt polling,
Auth-last deletion, residue checks, and an unrelated control user. Private state
and the raw opaque receipt remain under ignored `build/release-evidence/` and are
deleted after verification.

## Required isolated-staging access

Set these only in the operator shell or an approved secret store; never commit or
paste their values into evidence:

- `STAGING_ENVIRONMENT_ACK=isolated-staging`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_APP_URL`
- `STAGING_CRON_SECRET`
- `STAGING_TEST_PASSWORD` (must satisfy the staging Auth password policy)

The Supabase project must be at repository migration head and the staging web
deployment must use that same project and cron secret.

## Procedure

```powershell
npm run staging:seed-deletion-user
# Optional but required for provider-side proof: sign into the printed staging
# fixture through an authorized secure workflow and connect real staging-only
# Google/Oura/Fitbit grants. Do not use personal accounts.
npm run staging:test-account-deletion
npm run staging:verify-deletion-residue
```

The seed covers adult/legal acceptance, a task/calendar record, plan, subjective
and conversational check-ins, health observations, a derived summary, granular
AI consent/history/permit, push token, privacy request, Storage object, and an
unrelated control account. The deletion request creates the queued job. Free V1
has no subscription/entitlement state, and no customer-support platform is
configured.

The test runs the real staging worker. Its focused unit tests prove internal
dispatch, transient retry, and provider-first/Auth-last behavior, but that mock
evidence is deliberately not called provider-side proof. When real staging grants
exist, the receipt records only provider/status/HTTP category. A provider refresh
invalidation check still requires owner-supplied non-secret evidence. If a real
outage produces `retry_wait`, the script stops with Auth and encrypted credentials
intact; rerun after the staged fault or provider outage clears.

Successful residue verification writes sanitized JSON to
`docs/launch-readiness/evidence/04-auth-and-accounts/staging-account-deletion.json`.
It never contains email, UUID, password, token, endpoint, or service key. Remove
abandoned synthetic users through the staging dashboard if a run stops before the
worker completes.
