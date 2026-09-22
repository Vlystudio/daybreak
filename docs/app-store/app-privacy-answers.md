# App Store privacy-answer evidence

Generated from `config/privacy/app-store-disclosure.json`. Reviewed 2026-09-22. Free U.S. V1; optional AI, cloud integrations and app notifications disabled in production. This technical record does not claim App Store submission or publication.

| Apple type          | Linked | Tracking | Purposes                                 | Evidence                                                |
| ------------------- | ------ | -------- | ---------------------------------------- | ------------------------------------------------------- |
| Name                | Yes    | No       | AppFunctionality, ProductPersonalization | Profile name and greeting                               |
| EmailAddress        | Yes    | No       | AppFunctionality                         | Account authentication and support                      |
| Health              | Yes    | No       | AppFunctionality, ProductPersonalization | Optional Apple Health summaries and manual check-ins    |
| Fitness             | Yes    | No       | AppFunctionality, ProductPersonalization | Optional activity and workout summaries                 |
| CoarseLocation      | Yes    | No       | AppFunctionality, ProductPersonalization | Previously saved city; operational IP-derived location  |
| PhotosorVideos      | Yes    | No       | AppFunctionality                         | User-selected avatar                                    |
| CustomerSupport     | Yes    | No       | AppFunctionality                         | User support and privacy requests                       |
| OtherUserContent    | Yes    | No       | AppFunctionality, ProductPersonalization | Schedule, routine, goals and notes                      |
| UserID              | Yes    | No       | AppFunctionality                         | Account-linked records and authentication               |
| ProductInteraction  | Yes    | No       | AppFunctionality                         | Operational route requests and account/security actions |
| PerformanceData     | Yes    | No       | AppFunctionality                         | Hosting request timing and availability diagnostics     |
| OtherDiagnosticData | Yes    | No       | AppFunctionality                         | Hosting and authentication error/security logs          |
| OtherDataTypes      | Yes    | No       | AppFunctionality                         | Adult attestation, legal acceptance and preferences     |

## Excluded from the launch disclosure

- SensitiveInfo: No dedicated sensitive-information fields; wellness measurements and check-ins are disclosed under Health/Fitness.
- DeviceID: No device identifier or native push registration in the iOS launch flow.
- CrashData: Sentry is disabled for production. Hosting request errors are covered by OtherDiagnosticData.

## Required-reason APIs

- UserDefaults: CA92.1. Capacitor Preferences reads and writes only this app's connection and last-sync preferences.

No tracking, advertising, purchases, or paid digital features are configured. Re-review this record, the native manifest and App Store Connect whenever a provider or feature is enabled. Final archive evidence remains required.
