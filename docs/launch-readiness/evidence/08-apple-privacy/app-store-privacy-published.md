# App Store Connect privacy disclosure

On September 22, 2026, all 13 categories in
`config/privacy/app-store-disclosure.json` were saved in Daybreak Companion's
App Privacy questionnaire. Each is linked to identity and not used for tracking.
The purpose selections match that source record. No advertising purpose was selected.

Privacy policy: https://daybreak-one.vercel.app/privacy

Privacy choices: https://daybreak-one.vercel.app/support

The owner explicitly authorized the final publication declaration in the release
conversation. The browser then confirmed **Published a few seconds ago by
Benyamin Mahmoodi**. The app version remained **Prepare for Submission**; privacy
publication is not App Review submission or public app availability.

Native privacy-manifest reconciliation is part of the following signed candidate.
Required-reason API review identified Capacitor Preferences' app-only UserDefaults
use and added `CA92.1` to the application manifest. Installed Capacitor and
CapacitorCordova manifests declared no collection/tracking; Haptics' installed
source has no data collection or required-reason API use. Final archive inspection
must confirm the manifests and notices were actually bundled.

Sources consulted:

- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype
- https://www.npmjs.com/package/@capacitor/preferences
