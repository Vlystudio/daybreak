# iOS release evidence template

Create one private copy per candidate. Do not paste certificates, private keys,
profile contents, passwords, tokens, signed URLs, health data, or App Review
credentials into this document.

## Candidate identity

- Commit hash:
- Branch:
- Codemagic build URL/ID:
- Workflow (`ios-healthkit` expected):
- Build start/end UTC:
- Xcode version (`xcodebuild -version` output):
- Node/CocoaPods versions:

## Signed archive and IPA

- `.xcarchive` artifact/path:
- Archive timestamp:
- `.ipa` artifact/path:
- IPA SHA-256:
- dSYM artifact/path and UUID association:
- Bundle identifier (`app.daybreak.mobile` expected):
- Marketing version:
- Build number:
- Signing team ID (non-secret identifier only):
- Signing identity common name (no certificate contents):
- Embedded provisioning profile name and expiration (no profile contents):
- Code-signature verification result/log reference:
- Entitlement dump review reference:
- HealthKit entitlement result:
- Embedded-profile team/bundle/HealthKit result:
- Privacy manifest archive path/result:
- Icon declaration/source-integrity result:
- Launch-screen declaration/source-integrity result:
- ATS/cleartext result:
- Sanitized `ios-archive.json` artifact:

## Xcode privacy report

- Organizer archive selected:
- Report generated UTC:
- Secure report reference:
- App manifest reviewed:
- CocoaPod/framework manifests reviewed:
- Differences from `docs/app-store-privacy-mapping.md`:
- Reviewer/approval:

## TestFlight

- Upload result/log reference:
- App Store Connect version/build:
- Processing status and completion UTC:
- Processing warnings/errors:
- Internal testing group:
- Fresh install device/result:
- Upgrade from stale build device/result:

## Physical iPhone matrix

Attach the completed `docs/ios-release-device-test-plan.md` copy and record:

- Current full-size iPhone model/iOS/build/evidence:
- Small-screen iPhone model/iOS/build/evidence:
- Camera allowed/denied, Take Photo, library, Files, cancel, reselection:
- Repeated capture and background/resume:
- HealthKit disclosure/grant/denial/90-day/one-year behavior:
- AI consent grant/revocation and redaction behavior:
- Export and staging account-deletion evidence:
- VoiceOver, Dynamic Type, Reduced Motion, small-screen result:
- Network failure and termination/relaunch result:

## Final gate

- Database blocker cleared with approved evidence:
- Apple archive/privacy blocker cleared:
- TestFlight/device blocker cleared:
- App Store metadata/legal attestations complete:
- Release owner approval:
- Merge/launch decision:
