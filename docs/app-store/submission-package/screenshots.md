# Screenshot shot list and captions

Capture only the exact signed release on an Apple-required simulator/device size
using synthetic data. Remove status-bar personal details, notifications, email,
calendar names, health values tied to a person, OAuth identity, tokens, and debug
UI. Do not composite functionality that the app does not provide.

| Order | Screen                       | Draft caption                           | Required state                                                           |
| ----: | ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
|     1 | Dashboard/day plan           | Plan a day that fits your life          | Synthetic schedule and neutral wellness summary                          |
|     2 | Schedule                     | Keep routines and time in one view      | Synthetic tasks/events; no real calendar detail                          |
|     3 | Health overview              | Understand your wellness sources        | Synthetic/manual or approved demo data with provenance; no medical claim |
|     4 | Check-in                     | Add context in a few taps               | Synthetic mood/energy response                                           |
|     5 | Coach/plans                  | Turn goals into practical next steps    | Clearly labeled general-wellness plan                                    |
|     6 | Meals/grocery                | Plan meals and groceries together       | Synthetic foods and prices                                               |
|     7 | AI consent                   | You choose what AI may use              | All eight switches visible and initially off                             |
|     8 | Privacy settings             | Export, disconnect, or delete           | Export/rights/deletion controls visible                                  |
|     9 | HealthKit permission context | Health access is optional and read-only | Pre-permission explanation; never fabricate Apple’s system dialog        |
|    10 | Adult signup                 | Built for adults 18 and older           | Unchecked attestation and legal links                                    |

Apple currently accepts one to ten screenshots and can scale the highest required
resolution when the UI is identical. Confirm current size/localization rules in
App Store Connect at capture time. For each exported image, record filename,
SHA-256, build number, commit, device/simulator, iOS version, locale, capture date,
operator, synthetic account, and approval/evidence reference. Screenshots are
assets and remain blocked until provenance and commercial-use approval is recorded.
