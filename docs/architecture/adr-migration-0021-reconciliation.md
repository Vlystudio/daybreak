# ADR: migration 0021 reconciliation

- Status: Accepted for repository; production-history evidence remains blocked
- Date: 2026-07-28

## Context

The repository previously contained two different active files with version `0021`: an AI cache body (SHA-256 `035E2248D136837511175BC18421AABC1F5482DCEFE00ECE79EEC34F50F17312`) and a subjective-check-in body (SHA-256 `81D5E33BFB16AC22C17E5129321CA020606F16B2570B18DF6105FD7CE3F447FB`). Production migration history was not available in this environment, so choosing one historical state would be unsafe.

## Decision

The exact historical bytes are preserved outside the active migration stream in `supabase/legacy-migrations/`. Active version `0021_reconciled_legacy_bodies.sql` establishes both effects for a fresh database. Forward migration `0048_reconcile_0021.sql` is additive and idempotently detects and repairs neither, either, both, or partially created object states. No production history row is renamed or deleted.

`scripts/check-migrations.mjs` enforces one active file per version, preserved legacy checksums, canonical 0021 content, and forward reconciliation. `scripts/discover-migration-state.mjs` and `scripts/sql/migration-discovery-read-only.sql` provide read-only state discovery.

## Consequences

Fresh databases have one unambiguous ordering. Existing environments receive the missing behavior forward without data reassignment or destructive history edits. An authorized operator must still capture redacted `supabase_migrations.schema_migrations` identifiers/checksums and run the read-only discovery before applying `0048` to production.

## Verification

```text
npm run check:migrations
npm run test:db
```

The second command performs two disposable local resets and both pgTAP passes. It must never be pointed at a remote project. Production commands and expected evidence are in `docs/migration-reconciliation.md`.
