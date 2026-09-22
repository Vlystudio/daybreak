# Daybreak public App Store launch

Owner instruction, September 22, 2026: complete release preparation, submit the
app and publish after approval. This supersedes older checklist text saying Codex
may not submit. Required Apple agreement/declaration confirmations and real-device
testing must still be truthful; no approval or test result may be invented.

Launch scope: free, United States only; Today, Schedule, Health and account/privacy
controls. Keep the owner's residential address off public pages. Existing Apple
record: Daybreak Companion, `6784789934`, `app.daybreak.mobile`.

## Work record

- Owner supplied the private App Review phone number and agreed to test on iPhone.
  Do not put the number or review-account credentials in this public repository.
- App Store version draft: saved description, promotional text, keywords, support
  URL, copyright and private review-contact fields.
- App Information: saved Health & Fitness category and Plan Healthier Days subtitle.
- Pushed `f5f1145` to the existing release branch/PR 15 to obtain current CI evidence.
  CodeQL passed; npm 10 rejected missing optional dependencies in the npm 11 lockfile.
  Dependency Review also requires enabling the repository's dependency graph.
- Repaired the npm 10 cross-platform lockfile, enabled the dependency graph, and
  verified CI, CodeQL and Security all pass for `23d246f`.
- Saved free pricing, United States-only availability, an 18+ age override and the
  non-medical-device declaration. Privacy and privacy-choices URLs are saved.
- Owner confirmed artwork authorship; provenance is recorded in the ownership
  evidence folder. Shipped third-party notices still require completion.
- Codemagic build `6ab2cbffe82f50ac471ee891`, source `23d246f`, succeeded and
  uploaded 1.0.0 (29) for App Store distribution. Unlike build 28, the export is
  not internal-only. Apple processing completed and the owner reported the supplied
  checklist passed on iPhone 16 Pro Max / iOS 27 developer beta. The exact beta
  build was not provided; this does not establish stable-iOS coverage.
- Read back production Auth settings after hardening: password minimum 12,
  email confirmation required, and only the production callback in the allowlist.
- Prepared matching UI availability across Today, Schedule, Health, Profile and
  Settings. Paused integrations are not advertised; historical disconnect and
  permission-revocation controls remain. Profile edits preserve an unchanged city
  without calling the paused geocoder. 352 tests, TypeScript, lint and compliance
  freshness checks passed; cold route compilation is now a separate test setup.
- Promoted web source `e1db3e4`, Vercel deployment
  `dpl_AksUGuBGxJopXQ45sBUzwQxqURBu`, to the existing production origin. Verified
  signed-in Today, Schedule, Health and Settings; no residential address is public.
- Completed all 13 App Privacy categories and published them after the owner's
  explicit approval of Apple's final declaration. App Store Connect confirmed
  publication on September 22. This publishes disclosures, not the app itself.
- Reconciled the native manifest with the launch disclosure and added the required
  UserDefaults reason `CA92.1` for Capacitor Preferences. The next archive must
  contain this correction and bundled full dependency notices.
- Rehearsed migration 0055 through eight upgrade scenarios, two fresh resets and
  two runs of 112 SQL assertions. Applied the narrow permission changes to
  production and verified effective privileges. Anonymous SECURITY DEFINER access
  and the mutable search-path warning are resolved. Intended authenticated helper
  warnings and the Free-plan leaked-password limitation remain documented.
- Created a separate, email-confirmed synthetic review account with sample routine,
  schedule, habits and check-ins. Verified password sign-in and account-scoped
  profile access. Credentials are excluded from Git; no personal health data or
  OAuth connections were copied. Store screenshot capture uses only this account.

## Remaining milestones

- [x] Repair and verify Linux/macOS dependency installation and all release CI.
- [ ] Reconcile production provider/configuration gates with the reduced V1 scope.
- [x] Complete authentication, deletion and deployment evidence against safe fixtures.
- [x] Verify/publish the cohesive UI candidate and create a public-distribution archive.
- [ ] Capture actual simulator/device screenshots with synthetic data.
- [x] Save and publish App Privacy URL/disclosures and age rating.
- [x] Finish applicable content-rights and distribution declarations.
- [x] Set free pricing and United States availability; verify release settings.
- [x] Confirm artwork/content rights with the owner and review shipped licenses.
- [x] Provision review access without exposing credentials or using personal health data.
- [ ] Complete final privacy-manifest/report reconciliation and physical-iPhone checks.
- [ ] Submit to Apple, handle review feedback, and verify public availability after approval.

Build 28 is internal-only and cannot be submitted to the App Store. Build 29 has
owner-reported device results. Build 30 contains the corrected privacy manifest
and notices, and its final installation check passed. No version has been
submitted to Apple review or published. The Organizer report remains unavailable;
archive manifest inventory and published disclosures were reconciled separately.

## September 22 — build 30 and final listing preparation

- Promoted web deployment `dpl_5GkcXXZJaeXf3Wu8FNC71AchQPPD` after Linux build,
  CI/Security/CodeQL, and HTTP checks of notices and Privacy. No home address found.
- Codemagic `6ab2d9aa7d9842ce8feacad5` built source `8dcefe9` successfully in
  4m17s. Build 1.0.0 (30) passed archive/signing/HealthKit/privacy checks and Apple
  processing. Both existing internal groups have access. Focused What to Test
  notes are saved. The owner reports successful installation and all final smoke
  checks passed; the exact evidence and limits are in the build-30 device report.
- App Store draft selects build 30 and saves the synthetic review credentials,
  private review contact and accurate instructions for the paused-integration scope.
  Do not copy those credentials/contact fields into this public repository.
- Saved content-rights information after owner artwork attestation and dependency
  assessment. Completed DSA using the explicit **not planning to distribute in
  the EU** option; no claim of non-trader status was required. Apple's DSA status
  is Active. Free Apps Agreement is already Active; Paid Apps Agreement unused.
- Disabled automatic availability on Apple Silicon Macs and Apple Vision Pro.
- Apple's Add for Review validation reports only the missing iPhone screenshot
  set. The app remains Prepare for Submission, not submitted. Simulator capture
  is still running after fixing product naming and Xcode v1 test-plan handling.
- Real isolated deletion test: normal authentication/reauthentication, queue,
  HTTP worker, completed opaque receipt, zero database/Storage/Auth residue,
  rejected deleted-user login and unchanged control account. Provider grant
  invalidation was not exercised (connections are paused for new V1 users).
- Fourteen local Auth checks pass, including invalid adult/legal payload rejection,
  normal signup, global logout, recovery-token reuse rejection, password recovery,
  valid TOTP/AAL2 and invalid TOTP rejection. Local SMTP/confirmation settings
  differ from production; production configuration is recorded separately.
- Technical license assessment is documented with package versions, actual use,
  notices and scope limits. No attorney or executed-contract approval is invented.
- The production migration ledger contains the applied 0047–0054 bundle and 0055
  under timestamp versions. The legacy numeric-ledger verifier still reports a
  history-evidence gap; no production history was rewritten to satisfy it.
