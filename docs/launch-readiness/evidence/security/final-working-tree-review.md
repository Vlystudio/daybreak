# Final working-tree security and correctness review

Reviewed: 2026-07-28 (America/New_York)

Scope: the complete launch-readiness change set from base commit
`ed6923fd407f78f4708982ef42a907bf2dbdabd2`, including tracked modifications,
new files, deleted legacy migration filenames, generated compliance documents,
native assets, CI/Codemagic, and every migration through `0053`. This is a code
review record, not production, legal, Apple-signing, or physical-device proof.

## Material findings corrected

1. AI permits could be checked too late when provider configuration was absent,
   and LogMeal could consume a permit before its approval gate. Permit checks now
   precede provider readiness, durable consumption occurs only immediately before
   egress, and external HTTP paths reject redirects and use bounded timeouts.
2. Known-minor restriction deleted encrypted OAuth credentials before the
   provider-first deletion worker could revoke the remote grants. Restriction now
   disables app access/processing immediately while retaining service-only
   credentials solely for revocation; the adult-eligibility pgTAP fixture asserts
   that ordering.
3. Auth deletion cascaded the durable worker job before a completion receipt was
   finalized. Migration `0050` now lets the operational job briefly survive Auth,
   treats explicit Auth not-found as idempotent success, and uses a service-only
   transaction to atomically complete the receipt and remove the job/raw user ID.
4. Two high-impact admin endpoints shared `CRON_SECRET`. Both now use a dedicated
   constant-time `ADMIN_ACTION_SECRET` check; production validation requires a
   distinct value of at least 32 characters, and the release verifier checks the
   authorization boundary.
5. Optional processors had code paths that could egress solely because a key was
   configured. Google, Oura, Fitbit, Resend, web push, weather, Spoonacular, and
   GroceryTracker paths now require the structured processor registry and remain
   fail-closed in production until approved.
6. Canonical database success evidence could be written before the complete
   pgTAP run. The local database runner now writes canonical schema-v2 evidence
   only after two clean resets, the legacy upgrade matrix, and two full SQL test
   executions succeed.
7. Sixty Blender `.blend1` backup files (91,635,700 bytes) were tracked under
   `public/` and therefore deployable. They were removed from Git, the backup
   pattern is ignored, and the structured IP inventory no longer names it. The
   canonical `.blend` source files remain untouched and ignored. Five unused
   starter SVGs were also removed.
8. Three tracked asset-development tools contained a developer-specific absolute
   Windows temporary path. Their defaults now use the operating system temporary
   directory; repository scans find no developer/attachment paths.

## Invariants reviewed

- Adult eligibility is enforced by signup metadata, database trigger, existing-user
  request/server-action gates, and a restrictive database eligibility policy—not UI
  alone. False/absent attestation and known-minor paths fail closed.
- TOTP-enrolled accounts are forced from AAL1 to AAL2 at request and sensitive-action
  boundaries. Password recovery and global logout do not create an eligibility bypass.
- Deletion remains provider-first and Auth-last. Transient revocation or cleanup
  failures retain retry state and credentials; completion cannot be reported before
  the atomic receipt/job finalizer succeeds.
- AI production egress is limited to the server OpenAI/LogMeal boundaries, fixed
  destinations, approved providers, and short-lived purpose/category/epoch permits.
- Every one of the 75 public tables created by active migrations declares RLS.
  Cross-user rights/RPC/storage/realtime assertions are present in pgTAP, but their
  runtime result remains blocked by the local database infrastructure.
- Classified logging, Sentry scrubbing, analytics allowlists, and neutral notification
  bodies reject health, calendar-detail, prompt, credential, and free-text payloads.
- Legal versions come from a shared registry and require explicit acceptance; no
  migration silently accepts updated documents or adult status for existing users.
- Retention maintenance is service-only, dry-run by default, bounded to approved
  expired/operational records, and does not erase user records prematurely.
- Production processor/AI/legal identity and native signing/privacy/device evidence
  remain fail-closed rather than being represented by placeholders.

## Review and verification commands

| Command/check                                                                                                                                                                                       | Result                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `git status`, `git diff --stat`, complete diff/name review, `git diff --check`                                                                                                                      | PASS; only Git CRLF conversion notices, no whitespace error.                                                                        |
| Repository searches for secrets, local paths, debug markers, skipped/only tests, client credentials, direct AI egress, raw logging, admin/cron auth, policies, grants, and destructive placeholders | PASS after the corrections above. Expected generator console output and narrowly documented lint suppressions remain.               |
| Secretlint quick start and pinned Gitleaks 8.18.4 history/worktree scan                                                                                                                             | PASS; no leaks found across 165 commits.                                                                                            |
| `npm run typecheck`, `npm run lint`, `npm run test:run`                                                                                                                                             | PASS; 39 files / 252 tests.                                                                                                         |
| `npm run compliance:generate && npm run compliance:check`                                                                                                                                           | PASS; 30 generated artifacts match structured sources.                                                                              |
| Migration integrity and read-only static discovery                                                                                                                                                  | PASS; 53 unique active versions, both historical `0021` fingerprints preserved.                                                     |
| Full and production-only high-severity npm audits                                                                                                                                                   | PASS; zero vulnerabilities.                                                                                                         |
| `npm run build`                                                                                                                                                                                     | PASS with Next.js 16.2.12.                                                                                                          |
| Ruby installer syntax, Codemagic/GitHub workflow YAML parse, 21 Node script syntax checks, two Python development-tool syntax checks                                                                | PASS.                                                                                                                               |
| Deterministic iOS icon/splash regeneration                                                                                                                                                          | PASS; all 16 generated file hashes were unchanged on the second run.                                                                |
| `npm run test:db:preflight`                                                                                                                                                                         | BLOCKED, not passed: `WSLService` is disabled/stopped and Docker Engine is unreachable. No remote command or database mutation ran. |

## Residual risk and required follow-up

The SQL and pgTAP suites have not executed in this environment. A workstation
administrator must re-enable/start WSL and Docker, then run `npm run test:db` and
retain the schema-v2 success record. Production migration discovery, staging
provider/deletion proof, production configuration, legal/vendor/IP approvals,
the signed archive and aggregate Xcode privacy report, and the 70-scenario physical
iPhone record remain external gates. None is marked passed by this review.
