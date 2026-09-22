# Daybreak App Review notes

## What the app does

Daybreak is a free wellness and daily-planning companion. It combines user-entered schedules, habits, check-ins, weather, and optional connected wellness summaries to organize a day. It is not a medical device and does not diagnose or treat conditions.

## HealthKit

HealthKit access is read-only and begins only after **Settings → Connections → Apple Health → Connect**, where an in-app disclosure appears before Apple’s permission sheet. Daybreak uploads daily summaries to its Supabase backend. Initial import defaults to 90 days; the reviewer may select one year.

Requested read categories:

- sleep analysis;
- workouts;
- steps and walking/running distance;
- active and basal energy;
- heart-rate variability and resting heart rate;
- respiratory rate and oxygen saturation;
- body mass and body-fat percentage;
- VO₂ max and Apple exercise time.

Daybreak does not request glucose, blood pressure, body temperature, write access, microphone recording, or background location. If HealthKit is denied, partially authorized, unavailable, or empty, manual planning and all non-HealthKit features remain usable.

Disconnect at **Settings → Connections → Apple Health → disconnect icon**. The reviewer can stop synchronization while retaining imported data or disconnect and delete only Apple-sourced data. iOS permission can be revoked separately in Settings.

## AI consent

AI features are optional. **Schedule ? Review AI data choices** opens **Settings ? AI data use**. Seven visible categories default off: basic request data, task/plan context, check-ins, health summaries, calendar availability, detailed calendar text, and profile/preferences. Manual scheduling and check-ins remain usable with all choices off. Revocation invalidates outstanding permits before the next request. HealthKit permission and AI consent are separate.

Meal and receipt analysis are disabled in this release. Existing upload consent, if present, remains visible for revocation. AI output is general wellness guidance, not diagnosis.

## Privacy, deletion, camera

- Privacy Policy: **Settings → Legal & support → Privacy Policy**.
- Terms: **Settings → Legal & support → Terms of Service**.
- Data export and account deletion: **Settings → Data & privacy**.
- Support: **Settings → Legal & support → Contact support**.
- Camera/photo library: profile photo only in this release. The picker offers both library and Take Photo; no microphone audio is recorded.

## Reviewer account

Do not embed credentials in the application or this repository. Before submission, create a staging/review account in the production backend, seed representative sleep/activity/schedule/habit/check-in data, verify email, and enter the credentials in App Store Connect → App Review Information. Remove or rotate it after review.

The seeded account should not require the reviewer’s own Apple Health, Oura, Fitbit, or Google history. Keep HealthKit disconnected initially so the disclosure path can be reviewed.

## Temporarily disabled in V1

- Grocery, including meal plans, pantry, deals, receipts and shopping lists.
- Coach, including structured workouts and fitness/nutrition programs.
- Nutrition, including food photos, calories/macros, water and body-goal tracking.

- Friends, challenges, nudges, household sharing, and email lookup.
- Nest game (unless the existing production-safe flag is intentionally enabled after review).
- Subscriptions, premium tiers, and all purchase/checkout UI. V1 is free.

## Suggested reviewer navigation

1. Sign in with the review account.
2. Review Today, Schedule and Health seeded data.
3. Open Plan preferences, save daily rhythm and work hours, then return to Schedule. Leave AI data choices off and confirm manual events remain usable.
4. Enable basic processing plus the categories named by a selected AI feature, generate once, then revoke one required category and confirm the feature is blocked.
5. Open Apple Health connection disclosure; permission may be declined without blocking the app.
6. Test the profile photo library and Take Photo flows.
7. Locate export and in-app deletion under Settings.
