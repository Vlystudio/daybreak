# September 22, 2026 production release

Status: live. Production migration and Vercel promotion completed September 22, 2026.

## Release

- Live origin: https://daybreak-one.vercel.app
- Candidate: `dpl_6hhYcBxVoBFun2yQmJnGLGbW27Gz` / https://daybreak-5c101nogf-benyamin-s-projects2.vercel.app
- Source: working tree on `codex/app-store-launch-readiness`, based on `957efd3`; not an exact-commit CI claim.
- Product scope: Today, Schedule and Health. Grocery, Coach and Nutrition are disabled at navigation, route, action, AI and background-work boundaries.
- Production legal identity/contact settings were supplied by the operator and configured in Vercel. Effective dates are September 22, 2026. `/support` now provides account, privacy and security contact links. The existing `2026-07-28` consent version identifiers remain stable.

## Database plan and recovery evidence

The production schema had the subjective-check-in half of historical migration 0021, the 0046 consent columns, and no `supabase_migrations.schema_migrations` ledger. The missing forward stream is 0047–0054. Do not claim that migrations 0001–0046 were executed from these repository files or repair their historical records.

The forward stream was reviewed and applied atomically to an isolated PostgreSQL 17 restore of production. It preserves existing accounts, schedules, health observations and provider connections. Existing users become pending until they explicitly accept the current documents and adult attestation. AI choices reset to denied. Migration 0053 removes obsolete birth-year values; preflight found no known-minor accounts, and the release bundle refuses to proceed if that changes.

The backup includes `auth`, `public` and `storage` schemas, data, ownership and privileges. It contains Storage metadata, not object bytes; this release does not delete Storage objects. Both restore and migration rehearsal succeeded. The retained `production-prelaunch-complete.dump.dpapi` is encrypted with Windows DPAPI for the current Windows user; decryption was verified against the original checksum before removing plaintext copies. Backup artifacts and the checksum manifest are under the ignored `build/launch-scope-review/` directory and must not be published or committed.

The Supabase Management API applied the reviewed bundle as migration `20260922145052`, named `launch_forward_0047_through_0054_20260922`. The newly recorded release is actual execution evidence; the missing earlier history remains documented rather than invented. Later automated database pushes must account for this baseline instead of replaying the entire repository history.

Keep the old Vercel deployment available, but do not treat an application-only rollback as a database rollback: the previous app does not implement the new eligibility prompt. If validation fails after database application, prefer a reviewed forward fix. A database restore requires checking for writes since the backup and preserving them before restoring into the confirmed production project.

## Issues found and corrected in rehearsal

- 0048 failed when PostgreSQL decompiled an existing `BETWEEN` check into comparisons. It now recognizes the normalized constraint definition.
- 0051's permit function had an ambiguous `category` reference; the column is now qualified.
- 0049 now locks and checks account state so re-attestation cannot clear minor restrictions, suspension or pending deletion.
- 0054 explicitly establishes Data API CRUD privileges only after verifying RLS on every affected table. Function execution restrictions remain intact.
- SQL tests now allow authorization failures at the privilege layer, use valid top-level modifying CTEs, grant cross-role access only to their temporary fixtures, and order consent history by epoch.

These earlier migration corrections were made before their first production application. Historical 0021 files remain byte-for-byte unchanged.

## Verification

- Next.js production build, TypeScript and Support-page lint passed.
- Prior application suite: 47 files, 332 tests passed; targeted legal/AI checks passed again.
- All six SQL security suites passed: 105 assertions.
- Production restore/rehearsal verified signup triggers, ownership isolation, pending eligibility, no fabricated acceptance, AI disabled by default and retained record counts.
- Candidate Support, Privacy and Terms returned HTTP 200; browser Support displayed the configured operator and contact.
- Final guarded local run passed all eight upgrade scenarios, two clean resets and both executions of all 105 SQL assertions. Canonical evidence: `docs/launch-readiness/evidence/database/fresh-and-upgrade-test.json`. Windows reserved the default local ports, so the run used an isolated workspace copy on ports 56320–56327 with identical migration/test files and optional local services disabled. CLI telemetry was disabled to avoid its unrelated shutdown timeout.
- Production post-migration checks confirmed preserved account/profile/schedule/health/provider counts, pending eligibility without fabricated acceptances, zero public tables lacking RLS, and the corrected restriction/permit functions.
- Production promotion and the `daybreak-one.vercel.app` alias point to the candidate above. Ten HTTP checks passed, including public documents and login redirects for protected pages. The manifest has no photo share target. Browser verification confirmed the live Support page and the expected adult/legal confirmation prompt for the existing signed-in account. The post-promotion runtime error scan returned no errors.
- Authenticated production actions were not exercised as a real user; no adult/legal acceptance was submitted on the operator's behalf.

This is a web production release. Signed iOS/TestFlight validation, physical-device testing and App Store submission remain separate release work.
