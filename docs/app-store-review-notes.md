# Daybreak App Review notes

## What the app does

Daybreak is a free wellness and daily-planning companion. It combines user-entered schedules, nutrition, habits, workouts, weather, and optional connected wellness summaries to organize a day. It is not a medical device and does not diagnose or treat conditions.

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

Before the first AI briefing or generated plan, **Plan** shows a disclosure that identifies OpenAI as an external processor. Health summaries, calendar titles, and daily check-ins all default off and require separate opt-ins. Declining is allowed; general planning remains available. Choices can be revoked under **Settings → AI data use**, effective on the next request. HealthKit permission and AI consent are separate.

Meal/receipt photos are sent only after the reviewer deliberately selects the analysis feature. Images are resized/re-encoded to remove EXIF/location metadata and are processed transiently. AI output is general wellness guidance, not diagnosis.

## Privacy, deletion, camera

- Privacy Policy: **Settings → Legal & support → Privacy Policy**.
- Terms: **Settings → Legal & support → Terms of Service**.
- Data export and account deletion: **Settings → Data & privacy**.
- Support: **Settings → Legal & support → Contact support**.
- Camera/photo library: meal photo analysis, receipt analysis, and profile photo only. The picker offers both library and Take Photo; no microphone audio is recorded.

## Reviewer account

Do not embed credentials in the application or this repository. Before submission, create a staging/review account in the production backend, seed representative sleep/activity/schedule/nutrition/workout/check-in data, verify email, and enter the credentials in App Store Connect → App Review Information. Remove or rotate it after review.

The seeded account should not require the reviewer’s own Apple Health, Oura, Fitbit, or Google history. Keep HealthKit disconnected initially so the disclosure path can be reviewed.

## Temporarily disabled in V1

- Friends, challenges, nudges, household sharing, and email lookup.
- Nest game (unless the existing production-safe flag is intentionally enabled after review).
- Subscriptions, premium tiers, and all purchase/checkout UI. V1 is free.

## Suggested reviewer navigation

1. Sign in with the review account.
2. Review Today, Health, Schedule, Nutrition, Coach, and Grocery seeded data.
3. Open Plan, review AI disclosure, save all options off, and generate a general plan.
4. Enable one AI category in Settings, generate again, then revoke it.
5. Open Apple Health connection disclosure; permission may be declined without blocking the app.
6. Test meal/receipt photo library and Take Photo flows.
7. Locate export and in-app deletion under Settings.
