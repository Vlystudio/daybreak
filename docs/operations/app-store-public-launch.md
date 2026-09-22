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
  not internal-only. Apple processing was observed; device testing remains pending.
- Read back production Auth settings after hardening: password minimum 12,
  email confirmation required, and only the production callback in the allowlist.
- Prepared matching UI availability across Today, Schedule, Health, Profile and
  Settings. Paused integrations are not advertised; historical disconnect and
  permission-revocation controls remain. Profile edits preserve an unchanged city
  without calling the paused geocoder. 352 tests, TypeScript, lint and compliance
  freshness checks passed; cold route compilation is now a separate test setup.

## Remaining milestones

- [x] Repair and verify Linux/macOS dependency installation and all release CI.
- [ ] Reconcile production provider/configuration gates with the reduced V1 scope.
- [ ] Complete authentication, deletion and deployment evidence against safe fixtures.
- [ ] Verify/publish the cohesive UI candidate and create a public-distribution archive.
- [ ] Capture actual simulator/device screenshots with synthetic data.
- [ ] Save App Privacy URL/disclosures, age rating and applicable declarations.
- [x] Set free pricing and United States availability; verify release settings.
- [ ] Confirm artwork/content rights with the owner and review shipped licenses.
- [ ] Provision review access without exposing credentials or using personal health data.
- [ ] Complete final privacy-manifest/report reconciliation and physical-iPhone checks.
- [ ] Submit to Apple, handle review feedback, and verify public availability after approval.

Build 28 is internal-only and cannot be submitted to the App Store. Physical-device
results and any external approvals remain pending until evidence is actually supplied.
