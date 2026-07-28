# Physical iPhone release-candidate matrix

Run this matrix only against the exact signed candidate identified by Codemagic build ID, Git commit, build number, bundle ID, and IPA SHA-256. Run `npm run physical-device:form` to generate a complete 70-row form at `build/release-evidence/physical-device-results-form.json`; its metadata shape comes from `config/testing/physical-device-results.template.json` and its canonical scenario set comes from `config/testing/physical-device-scenarios.json`.

Each result must contain `id`, `result`, `evidence`, `notes`, `defectLink`, and `retestResult`. Evidence should be a controlled screenshot/video/log reference tied to the same candidate and device, not sensitive raw data. The test-account and tester fields are non-email controlled references. The validator rejects common email, token, credential, and raw-health-value patterns. A failed result requires a defect and a passing retest before completion. Only Sign in with Apple and the subscription warning may be not applicable, and both require a specific rationale reflecting the actual release surface.

Validate and write canonical sanitized evidence with:

`npm run physical-device:validate -- --input <completed-results.json> --evidence docs/launch-readiness/evidence/05-health-and-healthkit/physical-iphone-test.json`

The validator requires all 70 scenarios and refuses `not_run`, missing metadata/evidence, duplicate/unknown scenarios, invalid N/A claims, unresolved failures, a non-distribution install, a wrong bundle identifier, or an inexact commit/hash. The blank template is intentionally not evidence and does not mark physical testing complete.
