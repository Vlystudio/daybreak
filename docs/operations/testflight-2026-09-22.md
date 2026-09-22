# September 22, 2026 internal TestFlight build

Version **1.0.0 (28)** was signed, uploaded and processed successfully by Apple.
App Store Connect confirms **Testing** for the existing internal Testers group
(three testers). The build also includes the existing internal The boys group.
Testing notes were saved successfully; no external testers were added.

- App: Daybreak Companion, Apple ID `6784789934`, bundle `app.daybreak.mobile`.
- Source: `c469b5b91eba8d2b365d9866404f4307ddcddd0e`, branch `codex/app-store-launch-readiness`.
- [Successful Codemagic build](https://codemagic.io/app/6a3ec7fa81a721539762b2ab/build/6ab2a31414439b2df6c2cac2): `ios-testflight-internal`, Xcode 26.0, Mac mini M2, duration 3m 50s.
- Upload completed at `2026-09-22T15:50:39Z`; delivery `e032ab60-47ed-462b-a072-021b7e3ddbde`.
- [Processed TestFlight build](https://appstoreconnect.apple.com/teams/46216906-ff4d-4d44-828d-8254103c7d50/apps/6784789934/testflight/ios/e032ab60-47ed-462b-a072-021b7e3ddbde): internal testing verified September 22, 2026, with 90 days remaining. Installation on a physical iPhone has not been verified.
- Codemagic retained `App.ipa` (90,634,908 bytes) and `daybreak_4_artifacts.zip` (archive, dSYM and sanitized release evidence).
- Archive validation passed: signature, distribution profile, matching team/bundle/version, HealthKit, privacy manifest, ATS, export-compliance declaration, icons and launch screen. Logs confirm generation of `ios-signing-report.json`, `ios-privacy-inventory.json` and `ios-archive.json`.
- Repository typecheck, lint, tests, compliance, migration and deterministic asset checks passed on the cloud builder. Public runtime checks passed for login, support, privacy, terms, consumer-health privacy and the reduced-scope manifest.

This is an Apple-enforced internal-only TestFlight export. It cannot be submitted
to external beta review or the public App Store. Public launch approvals and
physical-device testing remain outstanding; this upload does not clear them.

## Build fixes

The release now identifies the existing App Store record, increments the latest
TestFlight build number, keeps native archive output aligned with validation,
and describes profile-photo use in camera/microphone/photo permissions.
Capacitor 6 template extraction uses a process-local import compatibility alias
with security-patched `tar@7.5.22`, covered by a real template extraction test.
Provisioning-profile evidence converts Apple plist dates explicitly and excludes
certificate bytes. OpenSSL 3 uses its legacy reader for the existing Apple-exported
PKCS#12 while preserving password, profile and code-signature checks.

Prior attempts: `6ab2a07b14439b2df6c2c905` canceled during preparation to correct
archive output; `6ab2a0c7f2ae46df68add930` stopped at Capacitor extraction;
`6ab2a1f3e2cbde15616057ce` stopped at PKCS#12 preflight. None uploaded a binary.

## Follow-up before public launch

Apple accepted the upload with warning `90068`: the current iOS 13 deployment
target must become iOS 15 or later for uploads starting in Spring 2027. Record
the supported-device decision and update the target before that requirement.
Fresh install, upgrade from build 27, profile camera, HealthKit, account deletion
and accessibility still require physical-iPhone evidence. The final Xcode
Organizer aggregate privacy report also remains outstanding.
