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
few schedule items, habits, manual health/check-in values,
and no real third-party OAuth grant. If HealthKit data cannot be pre-seeded,
reviewers can test empty/denied states; attach an owner-approved demo video for a
physical-device HealthKit example if requested.

## Core review flow

1. Sign in with the supplied email/password. The account is already a valid
   adult self-attestation with current Terms/Privacy acceptance.
2. Today and Schedule show synthetic planning data. Settings contains profile,
   privacy requests/export, MFA/global logout, legal links and deletion.
3. Open Plan preferences to set daily rhythm and optional work hours; save to return to Schedule.
   Cloud AI and external calendar/wearable connections are paused for this release.
   The normal planner, manual schedule, habits and daily check-in remain usable.
4. HealthKit: Health > Apple Health > Connect. The OS permission sheet requests
   read access only. Deny or grant any subset; the app handles denial, partial,
   empty, and sparse data. Imported readings are shown with their source. No health
   data is sent to AI in this release. The synthetic account has no Apple Health
   readings; test the import using a physical device's own permitted data.
5. Account deletion: Settings > Data & privacy > Delete account. Enter the
   current password and type `DELETE`. The account becomes unavailable
   immediately and redirects to an opaque receipt status while the durable
   worker revokes integrations, removes data/Storage, and deletes Auth last.
6. Password recovery is available on Login. Global logout and optional TOTP are
   under Settings > Account security.

The only account sign-in method is email/password. Google Calendar, Oura and Fitbit
are paused post-login connectors, not account login methods. Apple Health is a
native, optional data connection and does not create a Daybreak account.

## Deferred features

Grocery, Coach and Nutrition are unavailable in V1, including direct routes,
server actions and related AI processing. Today, Schedule and Health are the
primary tabs. Do not seed or submit screenshots of deferred feature flows.

## Subscriptions

Not applicable. There is no StoreKit code, paywall, subscription, entitlement,
paid digital feature, restore-purchases flow, or purchase metadata in V1. No
subscription review item should be submitted.

## Required private App Review contact

Enter an owner-authorized name, monitored email, and phone number. Confirm the
contact can answer during review and has access to the exact candidate, demo
account, TestFlight build, and defect tracker.
