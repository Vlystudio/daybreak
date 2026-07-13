# App Store privacy-label submission checklist

Last reviewed: July 13, 2026. This is an owner checklist based on the repository, not legal certification. Reconfirm it against production configuration and Apple’s current definitions immediately before submission.

Daybreak does not track users across companies’ apps/sites, sell personal information, use health information for advertising, or serve third-party ads.

| App Store data type                                                                          | Examples in Daybreak                                                       |   Collected |                                         Linked | Purpose                                                       | Notes                                                                                      |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------: | ---------------------------------------------: | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Contact Info — Email Address                                                                 | Supabase account email                                                     |         Yes |                                            Yes | App Functionality, account security, developer communications | Resend receives address for transactional email when enabled.                              |
| Contact Info — Name                                                                          | Display name                                                               |    Optional |                                            Yes | App Functionality                                             | User may leave it blank.                                                                   |
| Health & Fitness                                                                             | HealthKit, Oura, Fitbit, check-ins, body measurements, nutrition, workouts |    Optional |                                            Yes | App Functionality, Product Personalization                    | Never advertising; HealthKit is read-only; AI personalization requires separate opt-in.    |
| Location — Precise Location                                                                  | Coordinates derived from a user-entered city                               |    Optional |                                            Yes | App Functionality                                             | Stored for weather; no device or background location permission is requested.              |
| User Content — Photos or Videos                                                              | Meal, receipt, profile photographs                                         |    Optional | Profile photo: Yes; analysis photos: transient | App Functionality                                             | Meal/receipt images are re-encoded and processed transiently; no video or audio recording. |
| User Content — Other User Content                                                            | Check-in notes, goals, habits, schedule/event titles, grocery preferences  |    Optional |                                            Yes | App Functionality                                             | AI sharing is deny-by-default and consent-gated.                                           |
| Identifiers — User ID                                                                        | Supabase user UUID                                                         |         Yes |                                            Yes | App Functionality, security                                   | Not an advertising identifier.                                                             |
| Purchases                                                                                    | None in free V1                                                            |          No |                                              — | —                                                             | No StoreKit, RevenueCat, Stripe, or external checkout.                                     |
| Usage Data — Product Interaction                                                             | Feature/security audit events                                              |         Yes |                                            Yes | Analytics, App Functionality, security                        | Minimized; no raw health values/prompts/photos/tokens in logs.                             |
| Diagnostics — Crash Data                                                                     | Sentry crash reports when DSN enabled                                      | Conditional |                                    Potentially | App Functionality                                             | Verify Sentry scrubbing and production DSN before answering.                               |
| Diagnostics — Performance Data                                                               | Sentry performance telemetry if enabled                                    | Conditional |                                    Potentially | App Functionality                                             | Verify actual Sentry settings.                                                             |
| Device ID                                                                                    | Web-push endpoint/device subscription                                      |    Optional |                                            Yes | App Functionality                                             | Used only to deliver opted-in notifications.                                               |
| Contacts, Browsing History, Search History, Financial Info, Sensitive Info, Advertising Data | Not collected for launch                                                   |          No |                                              — | —                                                             | Recheck if product scope changes.                                                          |

## Processor/disclosure check

- Supabase: authentication, database, storage.
- Vercel: application hosting and delivery.
- OpenAI: optional AI generation after the current consent disclosure is recorded.
- LogMeal: optional meal-photo analysis when configured and after AI disclosure.
- Apple Health, Oura, Fitbit, Google Calendar: user-connected sources.
- Resend: transactional email.
- Sentry: diagnostics when configured.
- Web Push providers: notification delivery.

## Submission owner sign-off

- [ ] Compare every answer with the production environment variables and enabled integrations.
- [ ] Confirm Sentry data scrubbing, retention, and performance/session-replay settings.
- [ ] Confirm OpenAI and LogMeal retention/training controls under the applicable contracts.
- [ ] Confirm privacy policy URL is publicly reachable.
- [ ] Re-run account deletion against a representative staging user.
- [ ] Generate Xcode’s privacy report from the release archive and reconcile every SDK declaration.
