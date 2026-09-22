# Portable database runner static validation

Observed: 2026-07-29 (America/New_York)

Source baseline: `957efd3f7a5243d236956c5f221f50d308521f84`

Status: **BLOCKED — NOT DATABASE RUNTIME EVIDENCE**

The candidate adds explicit `local` and `isolated-remote` modes, a temporary
remote link, database/Management-API identity checks, hard production denials,
project/database allowlists, database-resident marker and expiry checks,
approved-role/credential acknowledgements, exact synthetic-state recovery,
credential redaction, direct TLS PostgreSQL pgTAP execution, and schema-v3
sanitized evidence generation.

| Check                                                                                      | Result                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Safeguard, marker, redaction, CLI-environment, pgTAP parser, and managed Auth-origin tests | PASS — 14 tests.                                                                                                                                 |
| Full Vitest suite                                                                          | PASS — 42 files / 268 tests.                                                                                                                     |
| Migration integrity                                                                        | PASS — 53 unique migrations; historical `0021` hashes intact.                                                                                    |
| Typecheck and lint                                                                         | PASS.                                                                                                                                            |
| Compliance generation/check                                                                | PASS — 30 structured artifacts.                                                                                                                  |
| Full moderate dependency audit                                                             | PASS — zero vulnerabilities.                                                                                                                     |
| Launch verifier                                                                            | PASS for repository implementation — 22 pass, 0 fail, 13 external/runtime blocked, 1 N/A.                                                        |
| Next.js 16.2.12 production build                                                           | PASS.                                                                                                                                            |
| Local database preflight                                                                   | BLOCKED — Docker Engine unreachable; no remote command ran.                                                                                      |
| Isolated-remote preflight                                                                  | BLOCKED before link — required authorized identity, allowlists, acknowledgements, and credentials are absent; no remote destructive command ran. |

No `fresh-and-upgrade-test.json` was created. Closure requires an authorized
operator to provision the marker and protected environment described in
`docs/database-runtime-testing.md`, run the complete suite, review the sanitized
schema-v3 artifact, and bind it to the exact candidate commit.
