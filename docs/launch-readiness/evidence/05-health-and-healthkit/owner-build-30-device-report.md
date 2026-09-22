# Owner final installation check — build 30

Date: 2026-09-22. Candidate: Daybreak Companion 1.0.0 (30), bundle
`app.daybreak.mobile`, source `8dcefe98dca38448732e9106c42deb4b0249adc6`.
IPA SHA-256: `7d74a226e472e06f9e20e497ec39f281c3333e9f5ffbfc6ffd6c7e8ee2582a22`.

Owner was asked to install build 30 from TestFlight, open/relaunch, visit Today,
Schedule, Health and Settings, and open Settings > Legal & support > Third-party
licenses. Response: **“Build 30 installed; all checks passed.”**

This is owner-reported evidence, not an automated observation. The owner's
previously reported test device is iPhone 16 Pro Max with iOS 27 developer beta;
the exact beta number and whether the OS changed for this smoke check were not
provided. Do not describe this as stable-iOS or full regression-matrix coverage.

The broader build-29 report remains separate. Build 30 corrects privacy
declarations and bundles dependency/font notices; it does not change the native
HealthKit permission/import implementation. Account deletion was tested only on
disposable local accounts, never on the owner's account.
