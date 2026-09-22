# App Store screenshot capture

Capture the real Capacitor shell from the release source against the production
web origin. The automated capture is an ad-hoc-signed simulator build of the same UI,
not a screenshot of the signed TestFlight binary. Its separate XCUITest target
signs in through the ordinary UI and is never included in the shipping archive.

Use only the dedicated synthetic App Review account. Never use the owner's
account, real health readings, OAuth identities, tokens or private contact details.
Do not composite or fabricate functionality. Status bar: 9:41, full battery;
English (U.S.), light appearance. Inspect each exported image before submission.

| Order | Actual screen    | Purpose                                                  |
| ----- | ---------------- | -------------------------------------------------------- |
| 1     | Today            | A readable daily plan with sample habits and schedule    |
| 2     | Schedule         | Routines and time in one view                            |
| 3     | Health           | Manual wellness context and optional native data sources |
| 4     | Check-in         | A brief mood and energy check-in                         |
| 5     | Plan preferences | Daily rhythm and optional working hours                  |
| 6     | Settings         | Appearance, security and account controls                |

Capture iPhone 17 Pro Max and iPad Pro 13-inch (M5) using Xcode 26.4.1 / iOS 26.4
simulator runtime. App Store Connect determines the accepted slots and dimensions.
The workflow writes a manifest containing the source commit, run ID, device,
runtime, origin, capture method and SHA-256 of every image. Only successful
captures are uploaded as workflow artifacts; test plans and result bundles can
contain credentials and must stay private to the temporary runner.

Cloud AI, Grocery, Coach, Nutrition and paused external connections must not be
advertised in screenshots. The capture workflow and artifact manifest are evidence
of real UI; they do not replace physical-device HealthKit or accessibility tests.
