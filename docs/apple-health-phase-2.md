# Apple Health — native HealthKit sync (one-tap, like Oura)

Goal: tapping **Connect Apple Health** on your iPhone shows the HealthKit
permission sheet once, then Daybreak syncs automatically forever — exactly as
seamless as Oura/Fitbit. This is only possible in a **native iOS app**: HealthKit
has no server API, so a browser can never read it. The web app keeps a guided
**export-file upload** as the no-app fallback.

You're on **Windows with no Mac** — that's fine. The iOS app builds entirely in
the cloud (Codemagic) and installs on your iPhone via TestFlight.

## What's already in the repo

Web + shared (all building and tested on web):

- Unified Connect UI — Apple Health sits beside Oura/Fitbit in the Connections
  card ([apple-health-connect.tsx](../src/components/settings/apple-health-connect.tsx),
  rendered by [calendar-sync-card.tsx](../src/components/dashboard/calendar-sync-card.tsx)).
  Native → one-tap connect+sync; web → export-upload dialog.
- Native bridge client ([healthkit.client.ts](../src/lib/integrations/apple-health/healthkit.client.ts))
  — reads HealthKit, aggregates with the shared
  [DailyAggregator](../src/lib/integrations/apple-health/aggregate.ts) (same code
  the export parser uses → zero drift), POSTs to the ingest route.
- Auto-sync on launch ([healthkit-autosync.tsx](../src/components/healthkit-autosync.tsx),
  mounted in the app layout) — native-only, no-op on web.
- Ingest endpoint `POST /api/ingest/apple-health`
  ([route.ts](../src/app/api/ingest/apple-health/route.ts)) — session-auth, shares
  persistence with the export upload.

Native (built in CI):

- HealthKit plugin [native/ios/HealthKitPlugin.swift](../native/ios/HealthKitPlugin.swift)
  - entitlements [native/ios/App.entitlements](../native/ios/App.entitlements).
- Project prep script [scripts/ios-prepare.sh](../scripts/ios-prepare.sh).
- Cloud build pipeline [codemagic.yaml](../codemagic.yaml).
- Capacitor config [capacitor.config.ts](../capacitor.config.ts) (loads the
  deployed web app remotely; `appId = app.daybreak.mobile`).

## Architecture

```
iPhone — Capacitor WKWebView loads daybreak-one.vercel.app (shares the Supabase cookie)
  │
  ├─ "Connect Apple Health"  → HealthKit.requestAuthorization (permission sheet, once)
  ├─ HealthKit plugin (Swift) → daily quantity aggregates + sleep + workouts
  │                              (HKStatisticsCollectionQuery → bounded volume)
  ▼
  TS client → DailyAggregator → POST /api/ingest/apple-health
                                       ▼
                  health_metrics / health_workouts / health_daily_samples
```

Incremental: the client stores the last sync time in Capacitor Preferences and
only pulls new days (re-pulling 3 days of overlap for late edits). First run
backfills 5 years. Daily upserts are idempotent.

---

## Setup (one time)

### 1. Apple Developer portal

- App IDs → register/edit `app.daybreak.mobile` → enable the **HealthKit**
  capability.
- Users & Access → Keys → create an **App Store Connect API key** (Team key,
  Admin/App Manager). Download the `.p8`, note the Key ID + Issuer ID.

### 2. App Store Connect

- Apps → New App → bundle id `app.daybreak.mobile`, name "Daybreak".

### 3. Codemagic (the cloud Mac)

- Sign in with GitHub, add this repo.
- Team integrations → **App Store Connect API key** → upload the `.p8`; name it
  `Daybreak ASC Key` (matches `integrations.app_store_connect` in
  [codemagic.yaml](../codemagic.yaml)).
- Environment variables → group **appstore** → add `APPLE_TEAM_ID` (your 10-char
  team id).
- Start the `ios-healthkit` workflow.

That's it — every push to `main` produces a TestFlight build. Install TestFlight
on your iPhone, accept the invite, run Daybreak, sign in, tap **Connect Apple
Health**, grant permission. Watch `apple_health_imports` for a row with
`source = 'healthkit'`.

---

## Building locally instead (if you ever get a Mac)

```bash
npm ci
npx cap add ios
bash scripts/ios-prepare.sh      # injects plugin + entitlements + Info.plist
npx cap sync ios
cd ios/App && pod install
npx cap open ios                 # Xcode: pick team + device, Run
```

---

## App Review notes (for public release; TestFlight needs none of this upfront)

HealthKit apps are reviewed for:

- A clear `NSHealthShareUsageDescription` (set by the prepare script).
- A privacy policy naming Apple Health — Daybreak's `/privacy` covers health
  data; confirm it states data isn't used for advertising and discloses that
  metrics go to OpenAI for the morning briefing (Settings → Your data already
  says this).
- Health data not shared with third parties beyond the disclosed purpose.
- A demo account for reviewers.

---

## Verifying

1. Real device with Health data (the Simulator has none unless you add it).
2. Connect → grant permission → toast confirms imported days.
3. `apple_health_imports.source = 'healthkit'`; `health_metrics`,
   `health_workouts`, `health_daily_samples` populate.
4. Reopen the app after a new workout → only the new data is sent (incremental).

## Notes / future

- **Background delivery:** current sync runs on app launch (foreground). For
  true background updates, add `HKObserverQuery` + `enableBackgroundDelivery`
  in the plugin and an `HKObserverQuery` handler in `AppDelegate` that calls the
  JS sync. Launch-time sync is enough for a daily wellness app to start.
- **Workout dedup across paths:** file-import and native use the same
  `workoutExternalId(activity, startedAtISO, durationSec)`, so importing both
  ways doesn't duplicate workouts.
