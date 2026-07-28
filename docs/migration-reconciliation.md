# Production migration reconciliation runbook

Repository migration ambiguity is repaired by the accepted ADR at `docs/architecture/adr-migration-0021-reconciliation.md`. Production history remains an external release blocker because this environment has no authorized production database access.

## Safe read-only discovery

1. On an authorized workstation, confirm the intended Supabase project, verify a current backup/recovery point, and obtain a database login restricted to read-only access. Do not use the service-role browser key as a database password.
2. Link the Supabase CLI to the confirmed project and set `SUPABASE_DB_PASSWORD` only in the operator shell. Do not paste the password or a connection URL into command history or arguments.
3. Run the guarded live command below. It verifies the linked project, statically rejects mutating SQL, starts a server-enforced read-only transaction, queries no application rows, and writes sanitized JSON without a hostname or credential:

   ```powershell
   node scripts/discover-migration-state.mjs --read-only --expected-project-ref cybpuscssilbguypptxi --evidence build/release-evidence/production-migration-discovery.sanitized.json
   ```

4. If an authorized DBA runs `scripts/sql/migration-discovery-read-only.sql` separately and returns its single JSON object, classify it offline with:

   ```powershell
   node scripts/discover-migration-state.mjs --read-only --expected-project-ref cybpuscssilbguypptxi --snapshot C:\secure\redacted-discovery.json --evidence build/release-evidence/production-migration-discovery.sanitized.json
   ```

   The snapshot must contain only schema/migration metadata from the supplied SQL. The classifier discards unknown fields and writes only an irreversible project-ref fingerprint.

5. Review `classification.state`, `partialState`, `reconciliationNeeded`, repository hashes, and observed history with the database owner. Expected output is schema version 1 JSON with `productionWritesPerformed: false`, separate `repositoryExpectations` and `observed` objects, and no hostname, connection string, user identifier, or credential.
6. **Do not run `migration repair`, `db reset`, history deletion/rename, or ad hoc DDL against production.** A partial/inconsistent result is a mandatory stop condition.
7. Only after explicit authorization, reviewed backup/recovery evidence, and a documented plan may an operator apply the normal forward migration stream through the supported deployment workflow.
8. Re-run read-only discovery and staging schema/RLS/account/consent checks. After review, copy the sanitized result to `docs/launch-readiness/evidence/database/production-migration-discovery.json` for launch verification.

## Required closing evidence

- Confirmed project/environment name and operator (no credentials).
- Pre- and post-change migration identifier/checksum snapshots.
- Classified legacy 0021 object state.
- Backup point and tested recovery procedure.
- Successful `0048` application and current migration list.
- Schema/RLS/account/consent synthetic verification.

Risk if skipped: production can diverge from repository assumptions, later migrations may fail, or a historical record could be incorrectly mutated.
