# Daybreak — AI, Health & Privacy (App Store review notes)

This document explains how Daybreak handles health-adjacent data and third-party
AI processing, and how users consent and opt out. It is written to support Apple
App Review and the App Privacy ("nutrition label") questionnaire.

Daybreak is a wellness/productivity companion. It is **not a medical device**, does
**not diagnose**, and provides general lifestyle guidance only.

## What data Daybreak processes

| Category             | Examples                                                            | Source                                                     |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Health & Fitness     | sleep, readiness/recovery, HRV, resting heart rate, steps, workouts | Oura, Fitbit, Apple Health (HealthKit), or manual check-in |
| Health (self-report) | mood / energy / stress / soreness (1–5), optional free-text note    | the user                                                   |
| Calendar             | event times and titles (busy windows)                               | Google Calendar (optional)                                 |
| Identifiers          | account user id, email                                              | Supabase Auth                                              |
| Usage / Diagnostics  | error reports (scrubbed of health values)                           | app telemetry / Sentry                                     |

HealthKit data is read on device, aggregated to **daily** values, and sent to
Daybreak's backend over HTTPS for the user's own briefing/trends. Daybreak does
not write to HealthKit. Only a last-sync **timestamp** is stored on device.

## Third-party AI processor disclosure

To generate the **morning briefing** and **daily plan**, Daybreak sends a short,
purpose-limited summary to an AI processor (**OpenAI**). What may be sent:

- a **source-aware health summary** (e.g. "sleep ~7h, recovery medium, from Apple
  Health") and how confident the read is;
- the **manual check-in** (structured 1–5 ratings, and the free-text note only if
  enabled);
- **busy calendar windows** (event titles only if enabled — otherwise the time is
  marked "Busy" with no title).

What is **never** done with this data:

- never used for **advertising** or sold;
- never used to **train** third-party models for unrelated purposes;
- never used to **diagnose** or make medical claims;
- raw health values, tokens, and free-text prompts are **not written to logs**.

## User consent & opt-out

Settings → **AI data use** exposes three independent toggles (all default on, with
this disclosure shown):

- `allow_ai_health_context` — health & wearable summary
- `allow_ai_checkin_context` — daily check-in free-text note
- `allow_ai_calendar_context` — calendar event titles

When a context is **off**, the server **omits it from the AI payload entirely**
(for calendar, busy time-blocks are still used for conflict-free scheduling, but
titles are replaced with a generic "Busy" label). With health context off,
Daybreak produces a more **general** wellness/productivity plan with no
health-specific reasoning, and the AI is instructed never to reference data that
was not provided.

Users can also, at any time: disconnect each provider, export their data, and
delete their account (Settings → privacy / connections).

## App Privacy questionnaire checklist

- **Health & Fitness** — Collected. Linked to the user. Purpose: App Functionality
  (the user's briefing/plan/trends). Not used for tracking. Not for ads.
- **Contacts/Calendar** — Calendar event data collected only with Google Calendar
  connected. Purpose: App Functionality (scheduling). Not for ads/tracking.
- **Identifiers** — User ID, email. Purpose: App Functionality / account.
- **Usage Data / Diagnostics** — Collected for app stability; scrubbed of health
  values. Not used for tracking.
- **Data shared with third parties** — Disclose the AI processor (OpenAI) as a
  service provider for generating briefings/plans, under the user's control via
  the opt-out toggles above. No data sold; no third-party advertising SDKs.
- **Tracking** — None. Daybreak does not track users across apps/websites.

## Security posture (summary)

Row-Level Security on all user tables; service-role writes scoped to a
server-derived user id; OAuth tokens AES-256-GCM encrypted at rest; nonce-based
CSP, HSTS; constant-time cron/admin auth; game economy mutations are atomic in
the database. See the security hardening notes for detail.
