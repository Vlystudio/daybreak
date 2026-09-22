# Database tests and upgrade matrix

The same logical migration, upgrade, pgTAP, RLS, consent, eligibility, privacy,
and deletion suite supports two modes:

- `local` uses the existing disposable Supabase CLI/Docker stack.
- `isolated-remote` uses a dedicated disposable Supabase project, a durable
  database identity marker, secure environment credentials, and a direct
  PostgreSQL pgTAP executor. It does not require Docker.

Remote mode is never inferred from credentials or linked CLI state. Omitting a
mode preserves the historical local default. Select remote mode explicitly with
`--mode isolated-remote` or `DAYBREAK_DB_TEST_MODE=isolated-remote`.

## Commands

```bash
npm run test:db:preflight       # backwards-compatible local preflight
npm run test:db:local           # explicit local complete suite
npm run test:db:preflight:remote
npm run test:db:remote          # explicit isolated-remote complete suite
npm run test:db:upgrades -- --mode local
```

See `docs/database-runtime-testing.md` for remote-project provisioning,
database-marker SQL, required environment variables, CI configuration, and
recovery steps.

Both paths pin Supabase CLI `2.108.0`, validate migration integrity, run six
duplicate-`0021` shapes, representative pre-eligibility/privacy/AI and durable
deletion upgrades, perform two clean head initializations, and execute every
file in this directory twice. Success writes the same schema-v3 evidence shape
to `docs/launch-readiness/evidence/database/fresh-and-upgrade-test.json` only
after the complete selected-mode suite passes.

## Safeguards

Local mode forces `--local`, requires `project_id = "daybreak-local"`, and does
not use checked-in or workstation Supabase link metadata.

Isolated-remote mode creates a temporary workdir, links it to an explicit
allowlisted project, and removes it on exit. Before every remote reset,
migration mutation, fixture operation, and pgTAP file it verifies:

- exact mode, project and database allowlists, destructive acknowledgement,
  and credential approval;
- the hard denial for production ref `cybpuscssilbguypptxi` and production
  origin `https://daybreak-one.vercel.app`;
- a non-expired database-level marker binding project ref, origin, database,
  approved role, zero-user baseline, and destructive-test authorization;
- the managed Supabase Auth `site_url`, which must equal that same approved
  non-production origin;
- absence of a database production marker;
- that every Auth row and Storage object is either absent or an exact,
  recognized synthetic fixture from this suite.

Remote credentials are read only from the process environment. They are never
passed in command arguments or evidence. Child output and exceptions redact
tokens, passwords, database URLs, and the raw project ref.
The password is withheld from `supabase link` to prevent native credential-store
persistence, and generic PostgreSQL target variables are removed from CLI child
processes.

## Coverage and boundaries

`rls_isolation_test.sql` creates two synthetic Auth users, seeds Alice's rows,
switches to `authenticated` with explicit JWT claims, and proves Bob sees none
of Alice's health, summary, schedule, or check-in data.

The remaining suites cover adult eligibility and existing-user legal gating,
granular AI consent and request-bound permit replay, privacy rights and
retention, durable account-deletion database behavior, catalog-wide RLS,
service-only RPC grants, restricted-account states, realtime publication, and
Storage metadata authorization.

These are PostgreSQL and Supabase database-schema tests. They prove Auth trigger
behavior against `auth.users` and Storage metadata/policies against
`storage.buckets` and `storage.objects`. They do not claim to test GoTrue HTTP
configuration, Storage HTTP/object-provider deletion, application session
invalidation, or external OAuth provider revocation. Those remain isolated
staging/application evidence and are identified separately in generated
evidence.
