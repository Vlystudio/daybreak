# Public address removal — September 22, 2026

Status: live at https://daybreak-one.vercel.app.

The owner requested removal of their residential address. Terms and Privacy now
provide email contact without a postal address. The public legal identity no
longer reads or exposes an address, and production validation no longer requires
one. All other legal identity requirements remain enforced. Effective dates and
accepted document versions are unchanged.

`LEGAL_BUSINESS_ADDRESS` was removed from Vercel project environment settings and
the ignored local environment/example files. Private Apple account information,
App Store territory selection and trader declarations were not changed.

## Release scope

- Source branch: `codex/remove-public-home-address`, based on pre-polish `9a1a7b4`.
- Application source: `081d2a7f34b6e1da00b29864385c64e1e93cc1ef`.
- Deployment: `dpl_3w7nfc54FcVCwRBxZhwUCQTLVhQh`.
- The production alias was verified through the Vercel API after promotion.
- The release retains the previously tested Next.js 16.3.6 and dependency security
  fixes, associated license inventory, and suppression of Server Function argument
  logging. The new UI/motion work and haptics dependency are excluded.
- Deployment metadata reports `gitDirty: 1` because generated documentation had
  line-ending-only working-tree changes. These had no Git content diff; do not
  represent this as an exact-commit CI deployment.
- This is a web update; TestFlight remains build 28.

## Verification

- Isolated release: 341 tests across 49 files, full lint, compliance artifact check
  and remote production build passed. Dependency audit reported zero vulnerabilities.
- Regression coverage accepts identity without an address and ensures a legacy
  address environment variable cannot appear in the returned identity. Missing
  operator identity and non-HTTPS public URLs remain invalid.
- Candidate Terms, Privacy, Support and Consumer Health Privacy rendered with the
  configured contact and no address or legal-identity render error.
- Six live public pages passed HTTP/content checks after promotion: Terms, Privacy,
  Support, Legal, Consumer Health Privacy and Security.
- Browser verification confirmed live Terms and Privacy omit the address, and the
  signed-in Settings page renders its legal/support and privacy controls.
- The polished local candidate was also rebuilt; local Settings and legal pages
  were verified without the address configuration.
- Project environment inventory confirmed no address variable remains.
- The previous deployment's unique Terms URL redirects unauthenticated visitors
  to Vercel sign-in. Its protected history is retained; this is not a claim of
  deleting third-party caches or every historical copy.

## Internal build review

Live release rating: **6.1/10**, unchanged from the pre-polish baseline. Strongest
improvement: the owner's address is no longer publicly displayed, and its absence
cannot break legal identity validation. The core visual hierarchy, long flows and
lack of physical-device/user-validation evidence still limit market readiness.
The local polished candidate remains **7.2/10** and has not been deployed. These
are subjective readiness assessments, not measured market outcomes.
