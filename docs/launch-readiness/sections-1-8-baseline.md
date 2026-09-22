# Daybreak App Store sections 1-8 baseline

Generated: 2026-07-28 (America/New_York)

This is the initial repository and executable-test baseline for the sections 1-8 launch-readiness mission. “Verified” below means the cited check was actually run or the artifact was directly inspected; it does not turn external legal, production, Apple, or device evidence into a pass.

## Verified existing behavior

- The worktree was clean before implementation (`git status --porcelain=v1`).
- Next.js 16.2.9, React 19.2.4, Supabase SSR, Capacitor 6, and a local Swift HealthKit plugin are present.
- `npm run typecheck` passed on 2026-07-28.
- `npm run lint` passed on 2026-07-28.
- `npm run test:run` passed 23 files / 199 tests on 2026-07-28.
- All reviewed application AI calls use the server-only `openaiClient()` boundary and require the in-process permit type.
- AI preference defaults were changed to deny-by-default by migration `0047_launch_privacy_controls.sql` after migration `0046_ai_consent.sql` had defaulted them on.
- HealthKit is read-only in the Swift bridge (`requestAuthorization(toShare: nil, read: ...)`); the client requests only its visible mapped types after a user starts connection.
- The native source includes a HealthKit entitlement, a privacy manifest, deterministic icon/splash assets, archive validation, and a Codemagic TestFlight workflow.
- Public Privacy and Terms routes exist and are unauthenticated.
- Data export and account deletion entry points derive the user ID from the authenticated session instead of client input.
- Repository SQL enables RLS on every table created by the inspected migrations. Public catalog tables intentionally have public-read policies; user-owned tables generally scope policies to `auth.uid()`.
- Secret scanning, CodeQL, dependency review, a blocking production dependency audit, lint, types, unit tests, and build jobs already exist in GitHub Actions.

## Existing but unverified behavior

- The full RLS suite exists, but was not executed because the local Docker engine is stopped.
- The generated iOS project, purpose strings, privacy-manifest target membership, archive signature, dSYM, provisioning profile, HealthKit capability, and final Xcode privacy report require a macOS build/archive.
- Production migration history and the actual remote schema were not queried; the repository contains a read-only discovery tool and runbook but no approved production credential/evidence was used.
- Provider OAuth revocation support and provider-specific deletion guarantees are not demonstrated by current tests.
- HealthKit partial authorization and device behavior are not demonstrated without physical-device evidence.
- Sentry is configured with default PII and Replay disabled, but no captured-event inspection proves that all application errors are redacted.

## Partially implemented behavior

- AI consent is versioned and deny-by-default, but currently covers only health, calendar titles, and check-ins. It lacks basic AI, task/plan, calendar availability, profile/preferences, uploaded-content categories, durable history, consent epoch, purpose binding, expiry, and replay protection.
- The current AI permit is an in-process symbol-bearing object. It is not a persisted, expiring, request-bound, replay-protected permit and does not independently bind purpose or provider.
- Account deletion explicitly removes storage, local provider credentials, push subscriptions, social relationships, and the auth user, but it is synchronous, not a durable state machine, has no recent-login proof, no provider-side revocation, no visible status, and no retry worker.
- Data export covers many tables but silently skips schema failures and omits several relational/user-rights categories.
- Legal copy covers privacy and basic terms, but no shared versioned document registry, acceptance records, reacceptance gate, consumer-health policy, AI disclosure, acceptable-use policy, retention explanation, health disclaimer, security-contact page, or rights-request workflow exists.
- RLS tests cover several high-risk tables, but the complete user-owned schema, RPCs, storage, views, and realtime subscriptions are not yet proven.
- The privacy manifest declares data categories, but its required-reason API/SDK provenance has not been reconciled to a machine-readable inventory or final Xcode privacy report.
- Health and AI output safety rules exist, but emergency/imminent-harm handling is not implemented as a dedicated tested boundary.
- Rate limiting exists for several authenticated operations, but browser-direct signup, login, reset, resend, and auth-provider endpoints are not all protected by Daybreak server enforcement.

## Missing behavior

- Mandatory pre-account adult self-attestation, server/database enforcement, under-18 rejection, existing-user restriction, minor-account response workflow, and tests.
- Versioned Terms/Privacy/health-document acceptance tied to adult attestation.
- Durable account status and eligibility enforcement across protected routes, server actions, cron, integrations, and AI.
- A complete AI consent record/history and purpose/category-specific server permit model with expiration, request binding, replay prevention, and revocation epoch.
- Durable deletion jobs, provider revocation attempts/status, retry/backoff, deletion audit minimization, and completion/status UI.
- Consumer-health rights request intake/status/appeal/processor propagation.
- Machine-readable retention schedule and production-safe retention job.
- Central classified logger/redactor and allowlisted analytics layer that rejects health and other sensitive keys.
- Central legal/business configuration with production placeholder rejection.
- Machine-readable AI provider, processor, data-flow, SDK, analytics-event, and privacy inventories plus consistency generation/tests.
- Complete public legal-document set and legal-claim-to-implementation checklist.
- Intellectual-property/license inventories, `THIRD_PARTY_NOTICES`, and a blocking license gate.
- Sections 1-8 release verifier and final evidence matrix.

## Incorrect or unsafe behavior

- Active migrations contain two different version `0021` files. `npm run test:db:preflight` fails before initialization, as designed.
- Signup is executed directly in the browser through Supabase Auth and accepts no adult attestation. No database/auth hook blocks direct or older-client signup.
- Terms state that users must be at least 16, contradicting the required adult-only 18+ service.
- Existing authenticated users are not restricted pending adult attestation and current legal acceptance.
- The AI permit can be reused for any AI feature during a server call and has no purpose/category upper bound beyond three preference booleans.
- Calendar busy time is always sent to AI even though calendar availability must be an independent consent category.
- Some production error logging includes raw provider/application error messages; a central sensitive redaction contract is absent.
- The current deletion UI describes an immediate permanent erase although backup expiration and asynchronous provider cleanup are not implemented or explained.
- Privacy/Terms content embeds contact values directly instead of using a validated legal-identity source.

## External/manual blockers

- Production migration-history/schema evidence: authorized production database operator plus a verified backup/restore point.
- Fresh database and pgTAP proof: Docker Desktop or an isolated PostgreSQL/Supabase CI runner.
- Final entity, seller, jurisdiction, address, policy dates, support/privacy/security contacts, and URLs: business owner/counsel.
- Attorney review of all public legal documents and jurisdiction-specific consumer-health/HIPAA/FTC/state-law analysis.
- Apple organization enrollment, agreements, tax/banking, App Store Connect record, signing certificate/profile, and final seller/developer identity.
- Signed archive, Xcode privacy report, SDK signatures, TestFlight/device tests, HealthKit authorization matrix, and deletion/device verification: macOS CI plus an authorized Apple account and physical supported iPhone.
- Executed DPAs/terms review, provider regions/retention settings, insurance, trademark/name/logo/domain/IP ownership evidence, and independent penetration test.

## Initial command evidence

| Command                     | Result                                                 |
| --------------------------- | ------------------------------------------------------ |
| `git status --porcelain=v1` | PASS — clean before implementation                     |
| `npm run typecheck`         | PASS                                                   |
| `npm run lint`              | PASS                                                   |
| `npm run test:run`          | PASS — 23 files, 199 tests                             |
| `npm run test:db:preflight` | FAIL/BLOCKED — duplicate `0021`; Docker engine stopped |

## Completion delta

The initial findings above are retained as historical baseline evidence. The
current implementation resolves the repository-controlled missing/unsafe items:
duplicate migration bodies are preserved as legacy fingerprints with one active
canonical history and forward reconciliation; adult/legal gates, AAL2, durable
provider-first deletion, purpose/category/epoch AI permits, rights/retention,
classified logging, processor/AI registries, public legal routes, compliance and
Apple/native evidence tooling, CI/Codemagic, and the release verifier are present.

The final local application pass is 39 files / 252 tests, 30 deterministic
compliance artifacts, 53 active migration versions, zero dependency/secret-scan
findings, and a successful Next.js 16.2.12 build. Database runtime evidence is
still honestly blocked because Windows `WSLService` is disabled and Docker Engine
cannot start; the duplicate `0021` condition itself is no longer the preflight
failure. External legal, production, signed-archive, and physical-device gates
remain blocked as listed in the current evidence matrix and dashboard.
