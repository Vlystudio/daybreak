# Privacy and permission submission draft

Use `docs/app-store/app-privacy-answers.md`, generated from the structured data
inventory, as the field-by-field App Privacy draft. Answer **Yes, data is
collected**. Include Daybreak’s practices and every integrated third-party SDK or
partner. Declare no tracking and no data used for third-party advertising.

Candidate URLs after production legal identity review:

- Privacy Policy: `https://daybreak-one.vercel.app/privacy`
- User Privacy Choices: `https://daybreak-one.vercel.app/settings#data-privacy`
  (requires login; also ensure public support content explains choices)
- Support: owner-approved public support URL based on `support-and-marketing.md`
- Marketing: owner-approved public marketing URL based on `support-and-marketing.md`
- Age suitability: owner-approved public adult-only explanation

An account is required to isolate private records with RLS, synchronize
preferences and permissions, secure provider connections, and make export,
rights-request, and deletion controls available. It is not required to monetize
the app; V1 is free.

Optional permissions:

- HealthKit: read-only selected sleep, heart/activity, body, and workout summary
  types. Denial leaves manual/non-HealthKit features available.
- Calendar/connectors: user starts each connection and may disconnect it.
  Calendar availability is separate from permission to use titles/descriptions
  as AI context.
- Notifications: neutral “content is ready” wording; denial leaves in-app use.
- Photos/camera: only user-initiated avatar, meal, or receipt flows. Analysis
  images are normalized and transient; avatars persist until changed/deleted.
- AI: all eight data categories default off, are purpose-specific, expire, and
  can be revoked. HealthKit authorization and legal acceptance do not grant AI
  consent.

Reconcile this draft with the signed archive’s aggregate Xcode privacy report,
embedded manifests, production processor approvals, diagnostics/log settings,
and actual App Store Connect fields immediately before submission.
