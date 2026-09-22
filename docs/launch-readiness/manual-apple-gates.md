# Manual Apple archive and submission gates

Repository configuration is preparatory evidence only. A macOS runner, Apple credentials, App Store Connect access, and physical device are unavailable here.

- [ ] Apple App ID `app.daybreak.mobile` belongs to the verified seller and has only required capabilities.
- [ ] Distribution certificate and provisioning profile match team, bundle ID, HealthKit entitlement, and expiration.
- [ ] Codemagic protected environment has the documented values without printing secrets.
- [ ] Signed candidate archive, IPA, dSYM, and `build/release-evidence/ios-archive.json` exist for the exact commit.
- [ ] `scripts/ios-release-validate.sh` passes on the signed candidate.
- [ ] Xcode privacy report is exported from that archive, sanitized, and reconciled to the data/SDK inventories.
- [ ] Dependency privacy manifests and required signatures validate in the final archive.
- [ ] Physical iPhone tests cover HealthKit no/partial/full/empty/revoked permission, camera, photo picker, offline, OAuth, account deletion, and neutral notifications.
- [ ] TestFlight review verifies production endpoints, legal links, adult gate, consent defaults, and no debug/admin/demo surface.
- [ ] App Store privacy answers match the final archive and approved processor configuration.

Exact build steps are in `codemagic.yaml`, `scripts/ios-prepare.sh`, `scripts/ios-release-validate.sh`, and `docs/ios-privacy-report.md`.
