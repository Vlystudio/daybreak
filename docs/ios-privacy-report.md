# Inspecting the iOS privacy report

1. Generate the iOS project with `npx cap add ios` when needed, run `bash scripts/ios-prepare.sh`, `npx cap sync ios`, and `cd ios/App && pod install`.
2. Open `ios/App/App.xcworkspace` in the pinned Xcode 26.0 release environment.
3. Product → Archive using the App Store distribution configuration.
4. In Organizer, select the archive and generate/export the privacy report using Xcode’s Privacy Report controls (wording may change between Xcode patches).
5. Confirm `App.app/PrivacyInfo.xcprivacy` exists and reconcile the aggregate report with `docs/app-store-privacy-mapping.md`.
6. Inspect every CocoaPod/framework entry. Third-party required-reason declarations must come from the owning SDK manifest; do not add invented reasons to Daybreak’s app manifest.
7. Run the archive validator with the IPA, archive, dSYM, expected version/build/team, and evidence output. The Codemagic workflow supplies these automatically and retains `build/release-evidence/ios-archive.json`.
8. Attach the exported privacy report or its approved secure-storage reference to `docs/ios-release-evidence-template.md`. The sanitized JSON artifact does not replace the Organizer report.

Daybreak’s direct Swift code uses HealthKit and ordinary Foundation formatting. The app manifest intentionally declares no required-reason API because no direct required-reason call was found. Re-audit after any native dependency or Swift change.
