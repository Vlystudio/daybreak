# Daybreak public App Store launch

Owner instruction, September 22, 2026: complete release preparation, submit the
app and publish after approval. This supersedes older checklist text saying Codex
may not submit. Required Apple agreement/declaration confirmations and real-device
testing must still be truthful; no approval or test result may be invented.

Launch scope: free, United States only; Today, Schedule, Health and account/privacy
controls. Keep the owner's residential address off public pages. Existing Apple
record: Daybreak Companion, `6784789934`, `app.daybreak.mobile`.

Current status: **Waiting for Review**. Apple accepted **1.0.0 (30)** on September
22, 2026 at **6:27 PM EDT**, submission `fd3eb2e1-601e-4d43-b12a-5633e5a3194d`.
Automatic release after approval is enabled for the free U.S.-only launch.
Approval and public availability remain pending.

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
- [x] Capture, inspect and upload actual iPhone screenshots with synthetic data.
- [x] Save and publish App Privacy URL/disclosures and age rating.
- [x] Finish applicable content-rights and distribution declarations.
- [x] Set free pricing and United States availability; verify release settings.
- [x] Confirm artwork/content rights with the owner and review shipped licenses.
- [x] Provision review access without exposing credentials or using personal health data.
- [x] Reconcile archive manifest inventory/disclosures and record owner build-30 checks.
- [ ] Obtain the broader Organizer report and exhaustive physical-device matrix evidence.
- [x] Submit build 30 to Apple and verify Waiting for Review.
- [ ] Handle actionable review feedback and verify public availability after approval.

Build 28 is internal-only and cannot be submitted to the App Store. Build 29 has
owner-reported device results. Build 30 contains the corrected privacy manifest
and notices, and its final installation check passed. Build 30 is submitted and
Waiting for Review; it is not yet publicly available. The Organizer report remains unavailable;
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
- Earlier Add for Review validation reported only the missing iPhone screenshot
  set. That blocker was subsequently resolved by the inspected uploads below.
  Capture tooling fixes included product naming and Xcode v1 test-plan handling.
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
- Follow-up welcome-page copy `5687acc` removes advertising for paused AI and
  Google Calendar/weather features. Production deployment
  `dpl_CZexkH6RbsrbfoMmGMkHSfyFbYBt` passed build/TypeScript and HTTP content checks
  and was promoted. The signed native package is still build 30; its hosted
  welcome page now accurately describes the launch. Product rating stays 7.2/10.
- The disposable local Next.js port 3002 and `daybreak-local` Docker services were
  stopped after successful tests; Docker retained its normal local backup.
- Follow-up source `7c8c958` makes OAuth callbacks reject missing inputs before
  unconditional HMAC verification and independently reject paused providers.
  Nine callback boundary tests pass, including valid/forged/mismatched state and
  disabled providers. CI reports 361 tests in 52 files; CodeQL/Security/CI passed.
  Deployment `dpl_3gA5x2jajmKefsJXZ1oRQC45XbMm` passed its production build and
  unauthenticated callback redirect check and was promoted. Native build remains 30.
- Actual simulator capture run `35783484716` passed both exploratory device jobs.
  Visual inspection rejected the cropped iPad compatibility-window captures;
  `ios-prepare.sh` has always scoped V1 to iPhone only. Four opaque 1320x2868 iPhone
  PNGs were uploaded and ordered Today, Schedule, Check-in, Connections. Apple
  automatically uses them for the required 6.5-inch slot. Their hashes and
  provenance are in `evidence/08-apple-privacy/store-screenshots.json`.
- The same visual inspection found cramped native time fields in Plan preferences.
  Source `15fe85c` stacks these fields on small screens and retains two columns on
  larger screens. Targeted lint/format, full CI/Security/CodeQL and the production
  build passed. Deployment `dpl_FG2qhjk81WsUaCFPYUCDtmWf42vn` returned HTTP 200 and
  was promoted. A limited last-20-minute error-log query returned zero records.
- Apple's Add for Review validator passed after screenshot upload. Build 30 is in
  a **Ready for Review** draft at this stage; the final submission is recorded below.
- Corrected the synthetic review fixture's numeric work-day values to the weekday
  names expected by the form, using that account's normal authenticated client and
  a scoped readback. No personal account or authorization rule was changed.
- Capture run `35785123384` passed six screens and strict 1320x2868 opaque-PNG
  validation. Visual inspection confirmed stacked time fields and corrected work
  days, but found remaining WebKit input overflow. Source `064dfce` normalizes
  native date/time field appearance and border-box sizing; production deployment
  `dpl_6Zpu2H6LAnGUA5H57yfjPM8ZE1qa` passed its build and was promoted. The live
  stylesheet contains the fix. CI, Security and CodeQL passed with 361 tests.
- Capture run `35787148705` stopped at sign-in before capturing the latest sizing
  fix. A separate ordinary account login and preferences readback passed; a
  limited production error-log query returned zero records, not proof that the
  UI login succeeded. Capture diagnostics now report only safe known UI messages
  and allow 90 seconds for navigation on slow cloud simulators. No auth control
  or production credential was changed to make the test pass.
- Follow-up `c1cb521` removes the remaining paused-AI planning control from Plan
  preferences using the existing server availability helper, and removes a stale
  calendar-setup promise. Targeted lint/format, TypeScript, six existing preference
  action tests and the production build passed. Deployment
  `dpl_DoTnoWWp81nYf1UB414wKxWxMSyy` was promoted before the simulator UI test began.
  The public origin returned the actual Daybreak page with HTTP 200. An ordinary
  synthetic-account session fetched `/onboarding` and verified daily/work-hour
  fields, Save, no page error and no automatic-planning control. The protected
  deployment-specific URL redirected to Vercel login and was not counted as an
  app-content check. No database preference was changed by this read-only smoke.
- Diagnostic run `35789645713` again stopped before app navigation. The configured
  email-entry assertion passed; no recognized login error or pending state was
  visible. The sampled deployment logs showed GET page loads but no login POST.
  This suggests a UI interaction issue but does not establish its cause. A further
  diagnostic run reports redacted static page labels, never field values or the
  raw accessibility tree. Submission was held pending the next run.
- Run `35790969516`, capture source `f1940ae`, passed the ordinary UI login and all
  six screen checks against live runtime `c1cb521`. Strict 1320x2868 RGB/no-alpha
  validation passed. All six screenshots were visually inspected: native time
  fields fit within the cards, core screens render normally, and no credentials,
  real health data or home address appear. The two prior intermittent login
  failures were not reproduced; their exact cause remains unproven. No production
  authentication change or bypass was used. The four uploaded listing images
  retain their original capture provenance.
- Clicked Submit for Review in the prepared Apple draft. Apple confirmed **1 Item
  Submitted**, then **Waiting for Review**. The submission detail page identifies
  build **1.0.0 (30)**, September 22 at **6:27 PM EDT**, and submission ID
  `fd3eb2e1-601e-4d43-b12a-5633e5a3194d`. No new binding agreement appeared at this
  step. Automatic release remains enabled. Approval/public availability are pending.
