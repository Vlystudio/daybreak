# Xcode aggregate privacy report

The Codemagic build inventories every `PrivacyInfo.xcprivacy` embedded in the signed archive and retains both the archive and `ios-privacy-inventory.json`. Apple documents aggregate privacy-report generation as an Xcode Organizer action; the repository does not claim that the inventory is Apple's aggregate report.

For the exact candidate archive:

1. Download the `.xcarchive` and sanitized evidence from the same Codemagic build.
2. Verify the build ID, commit, bundle identifier, version, build number, and IPA checksum against `ios-archive.json`.
3. On a supported Mac, open the archive in Xcode Organizer and choose **Generate Privacy Report**.
4. Export the report without editing it. Review every app/SDK manifest, required-reason API, tracking declaration, domain, collected data type, and SDK signature against `config/privacy/ios-sdk-inventory.json`, the App Store privacy answers, and the actual production configuration.
5. Store the report in the controlled launch-evidence system and record its non-secret reference, reviewer, date, Xcode version, build ID, commit, and outcome in the launch dashboard.

Any unexplained SDK, missing manifest/signature, unexpected tracking domain, undeclared data type, or required-reason mismatch blocks submission. Regenerate after any dependency, Xcode, native source, entitlement, privacy manifest, or build-setting change.
