# Daybreak launch dashboard

## Current release status — September 22, 2026

Candidate **1.0.0 (30)** is processed by Apple, selected in the App Store version,
and passed the owner's final installation/relaunch/screen/licenses check. The
owner authorized submission and automatic release after approval. The listing is
**Waiting for Review**: Apple accepted build 30 on September 22 at 6:27 PM EDT,
submission `fd3eb2e1-601e-4d43-b12a-5633e5a3194d`. Automatic release after approval
is enabled; public availability is not yet verified. Four inspected iPhone screenshots are saved in the correct
order, with Apple's 6.9-inch assets supplying the required 6.5-inch slot.

See the [current work record](../operations/app-store-public-launch.md),
[build-30 device result](evidence/05-health-and-healthkit/owner-build-30-device-report.md)
and [signed-archive evidence](evidence/08-apple-privacy/ios-archive.json).

- Production web deployment `dpl_DoTnoWWp81nYf1UB414wKxWxMSyy` (`c1cb521`) is live. Core
  signed-in screens, public home-address removal and notices/Privacy HTTP checks
  are verified. Release implementation has 361 tests plus passing TypeScript,
  lint, CI, Security and CodeQL checks.
- iPhone capture exposed native time-input overflow. Fields now stack on narrow
  screens, and date/time input sizing is normalized. Capture run `35790969516`
  passed normal UI sign-in and all six screens; all six images were inspected and
  the time fields fit within their cards. Earlier intermittent capture sign-in
  failures remain recorded; their exact cause was not established.
- Plan setup now uses the same server-side AI availability check as Settings and
  Schedule. The live authenticated page contains daily/work-hour fields and Save,
  with the paused automatic-planning control absent. Calendar setup is no longer
  promised by the completion message.
- Database hardening passed two fresh resets, two runs of 112 SQL assertions and
  eight upgrade scenarios. Production changes were verified. The timestamp
  migration ledger still needs a baseline-aware tooling follow-up; no historical
  entries were fabricated.
- The actual isolated deletion workflow and fourteen local Auth checks passed.
  Production Auth settings were read back separately. Tests do not establish
  actual production SMTP delivery, full browser MFA/recovery, or external grant
  revocation. No personal account was deleted.
- Published App Privacy has 13 categories and explicit owner declaration approval.
  The native manifest matches and includes Preferences reason `CA92.1`. Archive
  manifest inventory was inspected; no Organizer report export is claimed.
- Artwork authorship and a technical dependency-license assessment are recorded;
  full dependency/font notices shipped. This is not an attorney opinion.
- Metadata, review access/contact, age rating, content rights, free U.S.-only
  pricing, DSA non-EU-distribution option and automatic release are saved.
  Mac and Vision Pro availability are disabled.
- Internal rating remains **7.2/10**. Stable-iOS coverage, the full device matrix
  and first-time-user validation remain absent.

The broad historical inventory below is retained as an evidence backlog. It is
not a list of requirements imposed by Apple's submission validator. Paused AI,
Grocery, Coach, Nutrition and new external connections remain unavailable pending
their own reviews. Organization enrollment and paid agreements are not the chosen
individual/free distribution path. No attorney, trademark, insurance or executed
private processor-contract review is represented as complete; outstanding entries
are not silently converted to passes by the narrowed release scope.

## Historical inventory — superseded status snapshot

September 22, 2026 scope update: the live web app now focuses on Today, Schedule and Health, with Grocery, Coach and Nutrition disabled. See [scope changes, verification and remaining release work](launch-scope-2026-09-22.md). See the [production release record](../operations/production-release-2026-09-22.md). Native, legal-review and exact-commit CI evidence gates remain separate.

Last repository verification: 2026-07-29 (America/New_York). The portable database-runner candidate derives from pushed commit `957efd3f7a5243d236956c5f221f50d308521f84`; an isolated database run, final commit, and exact-commit CI remain required. `PASS` is repository or supplied-evidence proof, `BLOCKED` is not pass, and `N/A` requires the stated release-surface rationale.

| Gate                                                               | Status  | Responsible party                         | Required evidence                                                             | Revalidate                                                       |
| ------------------------------------------------------------------ | ------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Migration/compliance/security static controls                      | PASS    | Engineering                               | Release-verifier JSON and command log                                         | Every commit                                                     |
| Typecheck, lint, unit tests, dependency audit, production build    | PASS    | Engineering                               | Candidate command log: 42 files / 268 tests, zero audit findings              | Every commit/dependency change                                   |
| Portable database fresh/upgrade/pgTAP/RLS suite                    | PASS    | Isolated-test project owner / engineering | Schema-v3 `fresh-and-upgrade-test.json` from one complete guarded mode        | Every migration/Postgres/Supabase change                         |
| Read-only production migration discovery                           | BLOCKED | Production database operator              | Consistent forward-reconciled repository-head discovery JSON                  | Before migration/release; after every migration                  |
| Isolated-staging deletion and provider invalidation                | BLOCKED | Staging/integration owner                 | Zero residue, control intact, Auth rejected, actual provider refresh rejected | Every deletion/provider change; before release                   |
| Supabase Auth dashboard/session/MFA configuration                  | BLOCKED | Supabase project administrator            | `status: pass` sanitized 22-setting evidence                                  | Before release; quarterly; after setting change                  |
| Production endpoint, secret, legal, processor and AI configuration | BLOCKED | Release, legal/privacy, vendor owners     | Passing production-environment validator in protected CI                      | Every build/config/review expiry                                 |
| Attorney approval of exact public documents/jurisdictions          | BLOCKED | Qualified counsel                         | Dated approved record identifying reviewer and document set                   | Before release; every material legal/product/jurisdiction change |
| Vendor/processor/AI approval                                       | BLOCKED | Legal, privacy, security, contract owners | DPA/terms/region/retention/security evidence and current registry approval    | At recorded expiry; every provider/term change                   |
| License and first-party/AI asset provenance                        | BLOCKED | IP/license owner and counsel              | Obligation-specific license evidence and ownership/provenance records         | Before release; every dependency/asset change                    |
| App Store metadata/privacy/age/export answers                      | BLOCKED | App owner and counsel                     | Approved App Store Connect entries matching exact build/runtime               | Before each submission                                           |
| Codemagic repository workflow                                      | PASS    | Engineering                               | Static release controls and fail-closed encrypted-variable placeholders       | Every workflow/toolchain change                                  |
| Signed archive, IPA, dSYM, signing/profile/entitlement reports     | BLOCKED | Apple account/build owner                 | Passing sanitized archive/signing JSON plus retained artifacts                | Every candidate build                                            |
| Xcode aggregate privacy report                                     | BLOCKED | Apple build/privacy owner                 | Organizer export tied to IPA hash and complete reconciliation JSON            | Every native/dependency/Xcode change                             |
| Native automated-test preparation                                  | PASS    | Engineering                               | Nonproduction-only XCUITest target source and stable identifiers              | Every tested-flow/native-shell change                            |
| Physical iPhone 70-scenario matrix                                 | BLOCKED | Owner/QA with device                      | Validator-approved record for exact commit/build/hash/device                  | Every candidate build                                            |
| GitHub CI for exact pushed commit                                  | BLOCKED | Repository owner / engineering            | Green required checks for final commit                                        | Every commit                                                     |
| Sign in with Apple                                                 | N/A     | Product/engineering                       | Email/password-only auth decision; Google remains post-login connector        | Reassess before adding social login                              |
| Subscription warning behavior                                      | N/A     | Product/engineering                       | Free V1 with subscriptions source-locked off                                  | Reassess before monetization                                     |

September 22 database update: Docker local mode completed all eight upgrade scenarios and two passes of 105 SQL assertions. Production was backed up, restored and rehearsed, then upgraded through 0054 as recorded release migration `20260922145052`. The old migration history was absent and was not fabricated; the legacy numeric-history discovery gate needs a baseline-aware follow-up before future automated pushes. These are working-tree results, not exact-commit CI evidence. GitHub's Dependency graph is still unavailable, and the pushed `957efd3` CodeQL aggregate check reports four high URL-regex alerts; exact-token fixes pass locally but remain unpushed and unverified by CodeQL. No failed gate has been converted to a pass.
