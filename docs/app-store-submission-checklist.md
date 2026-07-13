# App Store submission checklist

## Build and signing

- [ ] Apple App ID `app.daybreak.mobile` has HealthKit enabled.
- [ ] Distribution certificate and provisioning profile include HealthKit.
- [ ] Codemagic secrets are configured without exposing them to build logs.
- [ ] Codemagic release uses Node 22, Xcode 26.0, `npm ci`, and the committed lockfile.
- [ ] `npm run ios:assets` produces no diff.
- [ ] Generated-project and archive release validation pass.
- [ ] Release IPA and dSYMs are retained; upload dSYMs if Sentry native symbolication is enabled.
- [ ] TestFlight release-candidate build installs on a physical iPhone.

## App Store Connect listing

- [ ] Name, subtitle, description, keywords, category, copyright.
- [ ] Semantic version and monotonically increasing build number.
- [ ] 1024×1024 app icon and approved screenshots for every declared device size.
- [ ] Support URL, privacy-policy URL, and optional marketing URL are reachable without login.
- [ ] Age rating reflects wellness content and optional user content.
- [ ] Export-compliance answers reviewed.
- [ ] Content-rights answers reviewed for recipes, provider data, imagery, and branding.
- [ ] App privacy labels reconciled with `docs/app-store-privacy-mapping.md`.
- [ ] Health-data declarations and read-only use accurately completed.
- [ ] No paid digital features or external checkout claims in metadata.

## App Review

- [ ] Dedicated review account created and representative demo data seeded.
- [ ] Credentials entered only in App Store Connect review information.
- [ ] Review notes copied/adapted from `docs/app-store-review-notes.md`.
- [ ] Backend, OAuth callbacks, email, weather, OpenAI fallback behavior, and support inbox checked.
- [ ] Friends/household/Nest/subscription disabled states confirmed in the production build.
- [ ] Privacy, Terms, export, deletion, AI consent, and Apple Health disclosure links tested.

## Final release gate

- [ ] Required web validation commands pass from a clean checkout.
- [ ] Supabase migration chain and SQL tests pass from zero and against staging history.
- [ ] Device matrix in `docs/ios-release-device-test-plan.md` completed on the exact TestFlight build.
- [ ] Xcode privacy report inspected and third-party SDK manifests reconciled.
- [ ] Production dependency high/critical audit is clear.
- [ ] Product owner and design owner approve icon, launch screen, screenshots, and copy.
