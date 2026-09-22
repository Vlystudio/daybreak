# App Store screenshot capture

Capture the real Capacitor shell from the release source against the production
web origin. The automated capture is an ad-hoc-signed simulator build of the same UI,
not a screenshot of the signed TestFlight binary. Its separate XCUITest target
signs in through the ordinary UI and is never included in the shipping archive.

Use only the dedicated synthetic App Review account. Never use the owner's
account, real health readings, OAuth identities, tokens or private contact details.
Do not composite or fabricate functionality. Status bar: 9:41, full battery;
English (U.S.), light appearance. Inspect each exported image before submission.

## Uploaded listing assets

Four inspected iPhone images are saved in App Store Connect, in this order:
Today, Schedule, Check-in and Connections (the Settings capture). Apple uses the
6.9-inch images for the required 6.5-inch display slot. Hashes and exact run/source
provenance are in the [screenshot evidence](../../launch-readiness/evidence/08-apple-privacy/store-screenshots.json).
The Health overview and Plan preferences captures were not selected for the
listing. Later layout checks do not silently replace the provenance of these
uploaded files.

## Automated six-screen verification set

| Order | Actual screen    | Purpose                                                  |
| ----- | ---------------- | -------------------------------------------------------- |
| 1     | Today            | A readable daily plan with sample habits and schedule    |
| 2     | Schedule         | Routines and time in one view                            |
| 3     | Health           | Manual wellness context and optional native data sources |
| 4     | Check-in         | A brief mood and energy check-in                         |
| 5     | Plan preferences | Daily rhythm and optional working hours                  |
| 6     | Settings         | Appearance, security and account controls                |

Capture iPhone 17 Pro Max using Xcode 26.6 / iOS 26.5. V1's native preparation
sets `TARGETED_DEVICE_FAMILY = 1`: it is iPhone-only. The exploratory iPad capture
ran in compatibility mode and produced cropped 780x1688 images; those are rejected
and must not be uploaded or represented as iPad support. Use the full-screen
capture API and require six opaque RGB PNGs at 1320x2868 for Apple's 6.9-inch slot.
The workflow writes a manifest containing the source commit, run ID, device,
runtime, origin, capture method and SHA-256 of every image. Only successful
captures are uploaded as workflow artifacts; test plans and result bundles can
contain credentials and must stay private to the temporary runner.

Cloud AI, Grocery, Coach, Nutrition and paused external connections must not be
advertised in screenshots. The capture workflow and artifact manifest are evidence
of real UI; they do not replace physical-device HealthKit or accessibility tests.
