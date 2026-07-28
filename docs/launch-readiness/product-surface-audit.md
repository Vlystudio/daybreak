# Product-surface audit

Audited: 2026-07-28 (America/New_York)

The audit covered tracked application, native, script, configuration, migration, workflow, and
release-documentation surfaces. Searches excluded generated dependencies and build output, and did
not count legitimate test mocks, SQL temporary tables, CSS/input `placeholder` attributes, model
temperature parameters, retry attempts, or artwork template types as unfinished product work.

## Resolved production-impacting findings

| Finding                                                                   | Resolution                                                                                                                                                                                        | Evidence                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate active migration version `0021`                                 | Preserved both original byte streams outside the active chain, introduced one reconciled `0021`, and added an idempotent forward reconciliation migration plus integrity/discovery/reset tooling. | `supabase/legacy-migrations`, `supabase/migrations/0021_reconciled_legacy_bodies.sql`, `supabase/migrations/0048_reconcile_0021.sql`, `scripts/check-migrations.mjs` |
| Browser signup lacked an adult gate and direct Auth calls could bypass it | Added unchecked UI attestation, server validation, Auth-trigger enforcement for every provider, and existing-user eligibility/legal gates.                                                        | `src/components/auth/auth-form.tsx`, `src/actions/auth.ts`, `src/lib/auth.ts`, migration `0049`                                                                      |
| Account deletion was synchronous and local-only                           | Added reauthentication, durable jobs, opaque status capability, remote provider revocation, retries, provider-first deletion, global sign-out, and Auth-last ordering.                            | `src/lib/account-deletion.ts`, `src/lib/integrations/tokens.ts`, migration `0050`                                                                                    |
| AI consent covered only three broad categories                            | Added eight independent deny-by-default categories, history, expiry/epoch, request-bound one-use permits, server egress checks, provider fail-closed registry, and revocation.                    | migration `0051`, `src/lib/integrations/ai-permit.ts`, `src/lib/integrations/ai-provider-registry.ts`                                                                |
| Raw error/logging paths could carry sensitive text                        | Centralized structured logging and Sentry scrubbing; release verification rejects direct application console calls.                                                                               | `src/lib/security/safe-logger.ts`, `src/lib/security/sentry-scrub.ts`                                                                                                |
| Legal identity and documents were embedded/incomplete                     | Added validated shared identity, production placeholder rejection, public versioned documents, acceptance records, and explicit attorney gate.                                                    | `src/lib/legal`, `src/app/legal`, `config/legal/legal-requirements.json`                                                                                             |
| Unsupported future health providers appeared in the V1 registry/UI        | Limited the source registry to implemented Apple Health, Oura, Fitbit, and manual entry.                                                                                                          | `src/lib/health/providers.ts`, `src/lib/health/providers.test.ts`                                                                                                    |
| Landing and review copy advertised disabled or obsolete behavior          | Removed the shared-household V1 claim and updated reviewer instructions to the eight-category consent flow.                                                                                       | `src/app/page.tsx`, `docs/app-store-review-notes.md`                                                                                                                 |
| Operator setup applied only `0001_init.sql`                               | Updated setup to require the complete ordered migration chain and migration integrity check.                                                                                                      | `README.md`                                                                                                                                                          |
| High-severity dependency findings were advisory                           | Upgraded Next.js and pinned audited transitive fixes; full dependency audit is blocking.                                                                                                          | `package.json`, `package-lock.json`, `.github/workflows/security.yml`                                                                                                |

## Justified non-production findings

- `vitest.config.ts` and Supabase configuration use loopback URLs only for isolated local tests and
  development. The native release configuration is fixed HTTPS with cleartext disabled.
- `.env.example` and README values are setup guidance. Production legal identity is mandatory and
  placeholder-like values are rejected by `src/lib/legal/identity.ts`.
- Test mocks and fixtures remain because they exercise negative paths without real credentials or
  health records.
- Form placeholder attributes are labels/examples for user input, not fake persisted data.
- The Nest and social code remains in the repository but its routes, navigation, mutations, and
  release UI are fail-closed by `src/lib/features.ts`; no review credentials or test users are
  embedded.
- Existing release-evidence templates and blocked historical attempt records are evidence forms,
  not claims that an external check passed.

## Outstanding external verification

Authenticated flows that require a real Supabase project, OAuth grants, a signed iOS candidate, or
a physical iPhone are not converted to passes by this audit. Exact closure evidence and owners are
listed in the final evidence matrix and manual gate documents.
