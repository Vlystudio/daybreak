# App Review notes and test instructions

Daybreak is an account-based daily wellness/planning app intended only for adults
aged 18 and older. It is general wellness software, not a medical device,
diagnosis, treatment, medication, clinical, or emergency service. V1 is free and
has no advertising, tracking, In-App Purchase, subscription, social feed,
messaging, or third-party account-login provider.

## Demo account

Supply a non-expiring, email-confirmed, synthetic production-review account in
App Store Connect’s protected username/password fields:

- Username: `[ENTER ONLY IN APP STORE CONNECT]`
- Password: `[ENTER ONLY IN APP STORE CONNECT]`
- TOTP: leave the primary review account unenrolled unless a stable reviewer
  procedure and second account are supplied in Notes.

Do not commit credentials. The demo user must contain only synthetic data and
must not bypass signup, adult/legal, consent, RLS, or deletion behavior. Seed a
few schedule items, habits, a workout/meal plan, manual health/check-in values,
and no real third-party OAuth grant. If HealthKit data cannot be pre-seeded,
reviewers can test empty/denied states; attach an owner-approved demo video for a
physical-device HealthKit example if requested.

## Core review flow

1. Sign in with the supplied email/password. The account is already a valid
   adult self-attestation with current Terms/Privacy acceptance.
2. Dashboard and Schedule show synthetic planning data. Settings contains
   profile, integrations, AI choices, privacy requests/export, MFA/global logout,
   and deletion.
3. AI: Settings > AI processing choices. All categories default off for new
   users. Enable Basic only, save, and invoke a briefing/plan; health and calendar
   detail remain excluded. Enable those separately to test; revoke and verify the
   next request is blocked or minimized. Output is labeled as AI/general wellness.
4. HealthKit: Health > Apple Health > Connect. The OS permission sheet requests
   read access only. Deny or grant any subset; the app handles denial, partial,
   empty, and sparse data. AI does not receive health context without separate
   health AI consent.
5. Account deletion: Settings > Data & privacy > Delete account. Enter the
   current password and type `DELETE`. The account becomes unavailable
   immediately and redirects to an opaque receipt status while the durable
   worker revokes integrations, removes data/Storage, and deletes Auth last.
6. Password recovery is available on Login. Global logout and optional TOTP are
   under Settings > Account security.

Google Calendar, Oura, and Fitbit are post-login optional connectors, not account
login methods. Sign in with Apple is therefore not applicable to this
email/password-only release. If the reviewer needs a connector demonstration,
provide a separate synthetic provider account and exact steps securely.

## Subscriptions

Not applicable. There is no StoreKit code, paywall, subscription, entitlement,
paid digital feature, restore-purchases flow, or purchase metadata in V1. No
subscription review item should be submitted.

## Required private App Review contact

Enter an owner-authorized name, monitored email, and phone number. Confirm the
contact can answer during review and has access to the exact candidate, demo
account, TestFlight build, and defect tracker.
